#!/usr/bin/env bash
# audio/sources/ -> audio/ : la palette livree.
#
#   tools/build-audio.sh
#
# LA PALETTE EST TRANSPOSEE, PAS RECOPIEE (§6.8 de la passation). Noverre n'est
# pas en centre-ville, et « baisser le gain des pistes de ville » ne marche pas :
# ce qui change avec la distance est le SPECTRE avant le niveau, et une ville a
# -35 dB garde ses passages de voiture.
#
# Trois decisions, chacune appuyee sur tools/mesure-spectre.py :
#
#   ville-proche      RETIREE. Ses evenements identifiables -- une portiere, un
#                     klaxon -- sont le tell d'un centre-ville. Elle ne se baisse
#                     pas, elle se retire.
#
#   ville-lointaine   RENOMMEE `lointain`, et PAS re-encodee. Le §6.8 prescrit un
#                     `lowpass=f=1200` puis 64 kbit/s -- mais la mesure dit que
#                     le fichier est DEJA la : f99 a 1050 Hz, et 0,0 % de son
#                     energie au-dessus de 4 kHz. Le filtre ne lui retirerait
#                     rien, et le re-encodage lui couterait une generation sur un
#                     materiau deja compresse. On ne paie pas une perte pour un
#                     traitement sans effet.
#
#   ville-interieure  RENOMMEE `lointain-interieur` : c'est la version filtree du
#                     NOUVEAU dehors. Deja mono 64k, f99 a 1561 Hz.
#
# Deux autres renommages, par honnetete de nommage : Noverre a un restaurant, pas
# un bar. Personne ne doit chercher un bar dans les fichiers.
#
# TOUT LE RESTE EST COPIE OCTET POUR OCTET. Les sources sont deja des mp3 : les
# re-encoder aux debits que la mesure « conseille » serait une seconde generation
# de perte sur un materiau qui n'a plus de master. La §6.5 raisonne depuis des
# masters ; ici on n'en a pas, et la regle qui prime est de ne pas degrader.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/audio/sources"
OUT="$ROOT/audio"

[ -d "$SRC" ] || { echo "introuvable : $SRC" >&2; exit 1; }

# source : destination
#
# `ville-proche` n'y figure pas, et c'est le point de la transposition.
#
# `foret-jour` est la seule piste qui ne vienne pas de Parkside. Elle comble le
# trou laisse par `ville-proche` : sans elle, le lever du jour de la premiere
# sequence n'avait plus d'element exterieur fort, et l'on n'entendait plus rien
# une fois le jour installe. Elle est aussi ce qu'on entend en sortant des
# fenetres. Gardee a son debit d'origine et non allegee : elle est FILTREE EN
# TEMPS REEL par le scellement, et un filtre revele les defauts d'encodage au
# lieu de les masquer (§6.5).
TABLE="
foret-jour:foret-jour
parc-nuit:parc-nuit
parc-jour:parc-jour
ville-lointaine:lointain
ville-interieure:lointain-interieur
vent:vent
eau:eau
spa-bourdon:spa-bourdon
spa-remous:spa-remous
musique-velos:musique-velos
musique-bar:musique-restaurant
piece-sport:piece-sport
piece-bar:piece-restaurant
rideau:rideau
air-seuil:air-seuil
hall-cles-pas:hall-cles-pas
logo:logo
"

total=0
echo
printf "  %-24s %-24s %9s\n" "source" "livre" "taille"
for ligne in $TABLE; do
  de="${ligne%%:*}"; vers="${ligne##*:}"
  [ -f "$SRC/$de.mp3" ] || { echo "  MANQUANT : $de.mp3" >&2; continue; }
  cp "$SRC/$de.mp3" "$OUT/$vers.mp3"
  o=$(stat -c%s "$OUT/$vers.mp3")
  total=$((total + o))
  marque=""
  [ "$de" != "$vers" ] && marque="  <- renommee"
  awk -v a="$de.mp3" -v b="$vers.mp3" -v o="$o" -v m="$marque" \
      'BEGIN{ printf "  %-24s %-24s %6.2f Mo%s\n", a, b, o/1048576, m }'
done

echo
awk -v t="$total" 'BEGIN{ printf "  TOTAL livre : %.2f Mo\n", t/1048576 }'
echo "  retiree : ville-proche (§6.8 -- ses evenements sont le tell d'un centre-ville)"
