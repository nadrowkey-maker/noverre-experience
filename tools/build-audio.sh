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
# TOUTES LES PISTES SONT RE-ENCODEES, et ce n'etait pas le cas au depart.
#
# Le premier jet les copiait octet pour octet, pour ne pas payer une seconde
# generation de perte sur un materiau qui n'a plus de master. C'etait le bon
# raisonnement sur le mauvais critere : ce qui coute sur ce site n'est pas le
# poids du fichier, c'est la MEMOIRE une fois decode -- et elle etait a 648 Mo.
# Une generation de MP3 en plus ne s'entend pas ; un onglet qui se recharge, si.
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
# source : destination : secondes de boucle : canaux : debit
#
# LES DUREES ET LES CANAUX SONT LA POUR LA MEMOIRE, pas pour le poids du
# fichier. Une piste decodee occupe `duree x 48000 x canaux x 4` octets : les
# dix-sept pesaient 31 Mo sur le disque et 648 Mo en memoire, tout decode au
# clic sur la porte. Mesure dans le navigateur : 11,5 s de decodage cumule, la
# derniere piste prete 8,5 s apres le clic. Un onglet de telephone n'a pas cette
# memoire, et c'etait la cause des a-coups et des chargements qui s'arretaient.
#
# Deux leviers, tous deux sans perte audible :
#
#   la duree    la §6.5 prescrit 60 a 90 s. Neuf pistes la depassaient, dont
#               `eau` a 555 secondes. On ramene a 90, avec un raccord qui rend
#               la boucle continue (voir tools/boucler.sh).
#   les canaux  les nappes diffuses passent en MONO. Le site les place au GAIN,
#               jamais au panoramique : leur stereo ne porte rien.
#
# Ce qui garde sa stereo : les deux musiques, et rien d autre. Ce sont les
# seules dont l image stereo se remarque.
#
# `vent` reste a 45 s parce qu il ne dure pas plus : le §6.8 previent qu il va
# se mettre a boucler maintenant qu il est expose, et la vraie reponse serait
# une prise plus longue, pas une coupe.
TABLE="
foret-jour:foret-jour:90:1:96
parc-nuit:parc-nuit:90:1:96
parc-jour:parc-jour:90:1:96
ville-lointaine:lointain:90:1:64
ville-interieure:lointain-interieur:55:1:64
vent:vent:45:1:64
eau:eau:90:1:96
spa-bourdon:spa-bourdon:54:1:64
spa-remous:spa-remous:38:1:64
musique-velos:musique-velos:120:2:192
musique-bar:musique-restaurant:120:2:192
piece-sport:piece-sport:90:1:96
piece-bar:piece-restaurant:90:1:96
rideau:rideau:5:2:128
air-seuil:air-seuil:4:2:96
hall-cles-pas:hall-cles-pas:7:2:128
logo:logo:12:2:192
"

total=0
pcm=0
echo
printf "  %-24s %7s %4s %13s %16s\n" "livre" "duree" "can" "mp3" "decodee"
for ligne in $TABLE; do
  IFS=: read -r de vers sec ch br <<< "$ligne"
  [ -f "$SRC/$de.mp3" ] || { echo "  MANQUANT : $de.mp3" >&2; continue; }
  bash "$ROOT/tools/boucler.sh" "$SRC/$de.mp3" "$OUT/$vers.mp3" "$sec" "$ch" "$br"
  o=$(stat -c%s "$OUT/$vers.mp3")
  d=$(ffprobe -v error -show_entries format=duration -of csv=p=0:nk=1 "$OUT/$vers.mp3")
  total=$((total + o))
  pcm=$(awk -v p="$pcm" -v d="$d" -v c="$ch" 'BEGIN{ printf "%.0f", p + d*48000*c*4 }')
done

echo
awk -v t="$total" -v p="$pcm" 'BEGIN{
  printf "  TOTAL livre : %.2f Mo sur le disque, %.0f Mo une fois decode\n", t/1048576, p/1048576 }'
echo "  retiree : ville-proche (§6.8 -- ses evenements sont le tell d'un centre-ville)"
