#!/usr/bin/env bash
# rush -> sequence d'images PNG.
#
#   tools/frames.sh 03-hall  12      -> build/frames-png/03-hall/0001.png ...
#   tools/frames.sh 05-velos 24
#
# Le deuxieme argument est le nombre d'images par seconde a conserver. On ne
# reencode jamais l'image ici, on la sort telle que le decodeur la rend.
#
# DIFFERENCE AVEC PARKSIDE : la cadence source n'est plus supposee. Parkside
# avait douze rushes tous a 24 img/s et l'ecrivait en dur. Ici 04-spa est a
# 30 img/s -- un plafond de 24 en dur l'aurait refuse, ou pire, aurait garde
# une image sur deux d'une cadence qu'il croyait etre 24 et produit un plan
# joue a la mauvaise vitesse sans que rien ne le signale. On lit donc la
# cadence reelle et on exige que le pas soit entier.
set -euo pipefail

CLIP="${1:?usage: frames.sh <clip-sans-extension> <img/s>}"
FPS="${2:?usage: frames.sh <clip-sans-extension> <img/s>}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/rushes/$CLIP.mp4"
OUT="$ROOT/build/frames-png/$CLIP"

[ -f "$SRC" ] || { echo "introuvable : $SRC" >&2; exit 1; }

# La cadence est une fraction exacte (24/1, 30000/1001...) : on la lit telle
# quelle et on la reduit, plutot que de faire confiance a un arrondi.
RATE=$(ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate \
       -of csv=p=0:nk=1 "$SRC")
SRC_FPS=$(awk -F/ '{ printf "%.6f", $1 / ($2 == "" ? 1 : $2) }' <<< "$RATE")

STEP=$(awk -v s="$SRC_FPS" -v f="$FPS" 'BEGIN{
  r = s / f;
  if (r < 0.999) { print "SUP"; exit }          # aucune image ne se fabrique
  if (r - int(r + 0.5) > 1e-3 || int(r + 0.5) - r > 1e-3) { print "FRAC"; exit }
  print int(r + 0.5) }')

case "$STEP" in
  SUP)  echo "$CLIP : $FPS img/s demande, la source n'en a que $SRC_FPS." >&2
        echo "        On n'interpole pas d'images ici." >&2; exit 1 ;;
  FRAC) echo "$CLIP : $FPS img/s ne divise pas la cadence source $SRC_FPS." >&2
        echo "        Choisissez un diviseur entier." >&2; exit 1 ;;
esac

rm -rf "$OUT"; mkdir -p "$OUT"

# select=not(mod(n,STEP)) garde une image sur STEP en partant de l'index 0.
# vsync 0 empeche ffmpeg de reinventer une cadence et de dupliquer des images :
# on veut exactement les images choisies, une pour une. Sans lui, un -r 12
# produirait des doublons et le scrub aurait des paliers invisibles a la
# lecture mais bien presents au defilement lent.
ffmpeg -v error -i "$SRC" \
  -vf "select=not(mod(n\,$STEP))" -vsync 0 \
  "$OUT/%04d.png"

N=$(ls "$OUT" | wc -l)
TOTAL=$(ffprobe -v error -select_streams v:0 -show_entries stream=nb_frames -of csv=p=0:nk=1 "$SRC")
echo "$CLIP : $N images extraites sur $TOTAL (source $SRC_FPS img/s, pas $STEP -> $FPS img/s)"
