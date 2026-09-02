#!/usr/bin/env bash
# PNG -> AVIF ou WebP, en parallele.
#
#   tools/encode.sh 03-comptoir avif 40
#   tools/encode.sh 03-comptoir webp 72
#
# Sort dans build/encoded/<format>/<clip>/. Rien ne va dans public/frames/
# avant que le banc ait tranche : voir .gitignore.
#
# Les deux qualites par defaut, crf 32 en AVIF et q 60 en WebP, sont APPARIEES :
# mesurees a SSIM 0.969 et 0.968 sur cinq images representatives des douze
# rushes. C'est la seule facon de comparer honnetement leurs poids, et c'est
# aussi ce qui rend le banc valide.
#
# Ne jamais changer l'une sans refaire la parite sur l'autre. Un crf 40 pese
# 16 ko contre 45 pour un q 72, mais a SSIM 0.950 contre 0.974 : ce n'est pas
# un gain de format, c'est une baisse de qualite.
set -euo pipefail

CLIP="${1:?usage: encode.sh <clip> <avif|webp> [qualite]}"
FMT="${2:?usage: encode.sh <clip> <avif|webp> [qualite]}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IN="$ROOT/build/frames-png/$CLIP"
OUT="$ROOT/build/encoded/$FMT/$CLIP"

[ -d "$IN" ] || { echo "extraire d'abord : tools/frames.sh $CLIP <img/s>" >&2; exit 1; }

# Autant de travaux que de coeurs : l'encodage AVIF est le poste le plus lent
# du pipeline et il est parfaitement parallelisable, une image etant
# independante de ses voisines.
JOBS=$(nproc 2>/dev/null || echo 4)

case "$FMT" in
  avif)
    Q="${3:-32}"
    # cpu-used 4 : le compromis retenu entre temps d'encodage et taille. Au-dela
    # de 6 le fichier grossit sensiblement, en dessous de 3 le gain ne paie plus
    # les heures sur 2412 images.
    enc() { ffmpeg -v error -y -i "$1" -c:v libaom-av1 -still-picture 1 \
              -crf "$3" -cpu-used 4 -pix_fmt yuv420p "$2"; }
    EXT=avif ;;
  webp)
    Q="${3:-60}"
    enc() { ffmpeg -v error -y -i "$1" -c:v libwebp -quality "$3" -preset picture "$2"; }
    EXT=webp ;;
  *) echo "format inconnu : $FMT (avif ou webp)" >&2; exit 1 ;;
esac
export -f enc 2>/dev/null || true

rm -rf "$OUT"; mkdir -p "$OUT"

START=$(date +%s)
n=0
for f in "$IN"/*.png; do
  base=$(basename "$f" .png)
  enc "$f" "$OUT/$base.$EXT" "$Q" &
  n=$((n+1))
  if [ $((n % JOBS)) -eq 0 ]; then wait; fi
done
wait
END=$(date +%s)

COUNT=$(ls "$OUT" | wc -l)
BYTES=$(du -sb "$OUT" | cut -f1)
awk -v c="$COUNT" -v b="$BYTES" -v f="$FMT" -v q="$Q" -v s="$((END-START))" 'BEGIN{
  printf "%s q%s : %d images, %.2f Mo, %.1f ko/image, %ds\n", f, q, c, b/1048576, b/c/1024, s
}'
