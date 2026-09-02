#!/usr/bin/env bash
# Fabrique une boucle de N secondes, RACCORDEE, a partir d'une prise plus longue.
#
#   tools/boucler.sh <source> <sortie> <secondes> <canaux> <debit>
#
# POURQUOI. Une piste decodee occupe `duree x taux x canaux x 4` octets, quel
# que soit son poids en MP3 : le decodage multiplie par vingt et un. Les
# dix-sept pistes du site pesaient 31 Mo sur le disque et 648 Mo en memoire,
# tout decode au clic sur la porte. Un onglet de telephone n'a pas cette
# memoire -- il evince, il rame, et il finit par recharger. C'etait la cause des
# a-coups et des chargements qui s'arretaient.
#
# La §6.5 prescrit des boucles de 60 a 90 s. Neuf pistes sur dix-sept la
# depassaient, dont `eau` a 555 secondes.
#
# LE RACCORD. Couper net a N secondes produit un clic a chaque tour : la fin ne
# rejoint pas le debut. La recette classique, appliquee ici :
#
#   P = source[0 .. N]      avec un fondu d'ENTREE sur les F premieres secondes
#   Q = source[N .. N+F]    avec un fondu de SORTIE sur ses F secondes
#   resultat = P + Q melanges sur les F premieres secondes
#
# Le resultat dure N. Sa fin vaut source[N-] et son debut vaut source[N] : les
# deux sont contigus dans la prise d'origine, donc la boucle est continue. Ce
# n'est pas un fondu croise pose au hasard, c'est le raccord naturel du son sur
# lui-meme.
#
# LE MONO. Les nappes diffuses n'ont aucune information stereo qui compte : le
# site les place au GAIN, jamais au panoramique. Les passer en mono divise leur
# empreinte par deux sans rien retirer de ce qu'on entend. Les musiques, elles,
# restent stereo.
set -euo pipefail

SRC="${1:?usage: boucler.sh <source> <sortie> <secondes> <canaux> <debit>}"
OUT="${2:?}"
N="${3:?}"
CANAUX="${4:?}"
DEBIT="${5:?}"

# Le fondu de raccord. Trois secondes : assez pour que deux ambiances se
# recouvrent sans qu'on entende le passage, assez court pour ne pas manger une
# part sensible de la boucle.
F=3

DUREE=$(ffprobe -v error -show_entries format=duration -of csv=p=0:nk=1 "$SRC")
COURTE=$(awk -v d="$DUREE" -v n="$N" -v f="$F" 'BEGIN{ print (d < n + f) ? 1 : 0 }')

if [ "$COURTE" = "1" ]; then
  # La prise est deja plus courte que la boucle demandee : on ne la rallonge
  # pas, on se contente du canal et du debit.
  ffmpeg -v error -y -i "$SRC" -ac "$CANAUX" -b:a "${DEBIT}k" "$OUT"
else
  ffmpeg -v error -y -i "$SRC" -filter_complex "
    [0:a]atrim=0:${N},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=${F}[p];
    [0:a]atrim=${N}:$((N + F)),asetpts=PTS-STARTPTS,afade=t=out:st=0:d=${F}[q];
    [p][q]amix=inputs=2:duration=first:normalize=0[m]" \
    -map "[m]" -ac "$CANAUX" -b:a "${DEBIT}k" "$OUT"
fi

D=$(ffprobe -v error -show_entries format=duration -of csv=p=0:nk=1 "$OUT")
O=$(stat -c%s "$OUT")
awk -v n="$(basename "$OUT")" -v d="$D" -v c="$CANAUX" -v o="$O" 'BEGIN{
  printf "  %-24s %6.1fs %dch %6.2f Mo mp3 %7.1f Mo decodee\n",
         n, d, c, o/1048576, d*48000*c*4/1048576 }'
