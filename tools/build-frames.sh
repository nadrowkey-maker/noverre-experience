#!/usr/bin/env bash
# Chaine complete : rush -> images -> deux jeux encodes.
#
#   tools/build-frames.sh              les treize sequences
#   tools/build-frames.sh 13-piscine   une seule
#
# Deux jeux de sortie :
#   build/encoded/webp-1280/  bureau
#   build/encoded/webp-854/   mobile
#
# La largeur mobile decoule du plafond de rapport de pixels a 2 : sur un
# telephone la bande 16:9 fait 390 px CSS de large, soit 780 pixels d'appareil
# a ce plafond, et 854 laisse 9 % de marge. Au-dela de 2 on agrandirait de
# toute facon.
#
# La qualite varie par sequence. Elle est pilotee par le RISQUE DE BANDES --
# la part de l'image a la fois sombre et lisse, ou un codec avec perte plafonne
# un degrade sur quelques valeurs -- et non par le detail, qui coute des octets
# mais masque les defauts. Les valeurs ci-dessous viennent de
# tools/mesure-bandes.mjs, qui cherche les images les PLUS difficiles de chaque
# clip et non des images prises au milieu : une mesure prise au milieu manque
# l'heure bleue d'une facade et la nuit d'un toit, et donne une qualite trop
# basse.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
JOBS=$(nproc 2>/dev/null || echo 4)

# clip : images/s : qualite
#
# 05-velos reste a 24 : les pedales tournent, et a 12 les manivelles seraient
# crantees. Il coute deux fois plus d'images, et le tampon exprime en pixels
# de defilement (et non en nombre d'images) lui rend le meme tampon qu'aux
# autres -- c'est exactement le bug corrige en §4.2 de la passation.
#
# 04-spa est a 30 parce que sa source y est, et qu'il ne dure que 2,9 s : on
# garde toutes ses images, il n'y en a deja pas beaucoup.
CONFIG="
01-facade:12:95
02-approche:12:92
03-hall:12:95
04-spa:30:95
05-velos:24:95
06-salle-sport:12:92
07-yoga:12:95
08-salon:12:92
09-chambre:12:90
10-balcon:12:90
11-montee-toit:12:95
12-restaurant:12:92
13-piscine:12:95
"

SEUL="${1:-}"
TOTAL_1280=0; TOTAL_854=0

for ligne in $CONFIG; do
  clip="${ligne%%:*}"; reste="${ligne#*:}"
  fps="${reste%%:*}"; q="${reste##*:}"
  [ -n "$SEUL" ] && [ "$SEUL" != "$clip" ] && continue

  bash "$ROOT/tools/frames.sh" "$clip" "$fps" >/dev/null
  PNG="$ROOT/build/frames-png/$clip"

  # La source de Parkside faisait 1280 partout, donc le jeu bureau n'avait
  # jamais a redimensionner. Ici 04-spa est en 1920 : sans cette branche il
  # partirait en 1920 dans le jeu « 1280 », pesant trois fois trop lourd et
  # decodant pour une surface que l'ecran n'affichera jamais.
  LARGEUR=$(ffprobe -v error -select_streams v:0 -show_entries stream=width \
            -of csv=p=0:nk=1 "$ROOT/rushes/$clip.mp4")

  for w in 1280 854; do
    OUT="$ROOT/build/encoded/webp-$w/$clip"
    rm -rf "$OUT"; mkdir -p "$OUT"
    n=0
    for f in "$PNG"/*.png; do
      b=$(basename "$f" .png)
      if [ "$w" -eq 1280 ] && [ "$LARGEUR" -le 1280 ]; then
        ffmpeg -v error -y -i "$f" -c:v libwebp -quality "$q" -preset picture "$OUT/$b.webp" &
      else
        ffmpeg -v error -y -i "$f" -vf "scale=$w:-2:flags=lanczos" \
               -c:v libwebp -quality "$q" -preset picture "$OUT/$b.webp" &
      fi
      n=$((n+1)); [ $((n % JOBS)) -eq 0 ] && wait
    done
    wait
    o=$(du -sb "$OUT" | cut -f1)
    [ "$w" -eq 1280 ] && TOTAL_1280=$((TOTAL_1280+o)) || TOTAL_854=$((TOTAL_854+o))
  done

  # Les PNG intermediaires sont jetes des qu'ils ont servi : les garder tous
  # ferait plusieurs gigaoctets pour rien, et frames.sh les reproduit.
  rm -rf "$PNG"

  a=$(du -sb "$ROOT/build/encoded/webp-1280/$clip" | cut -f1)
  b=$(du -sb "$ROOT/build/encoded/webp-854/$clip" | cut -f1)
  awk -v c="$clip" -v q="$q" -v n="$(ls "$ROOT/build/encoded/webp-1280/$clip" | wc -l)" \
      -v a="$a" -v b="$b" 'BEGIN{printf "%-20s q%-3s %4d img   1280: %6.2f Mo   854: %6.2f Mo\n", c, q, n, a/1048576, b/1048576}'
done

awk -v a="$TOTAL_1280" -v b="$TOTAL_854" 'BEGIN{
  printf "\nTOTAL   1280: %.2f Mo   854: %.2f Mo   (mobile = %.0f %% du bureau)\n",
         a/1048576, b/1048576, 100*b/a }'
