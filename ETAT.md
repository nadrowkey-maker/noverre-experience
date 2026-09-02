# Noverre — état du projet

Ce document dit ce qui est fait, ce qui est mesuré, et ce qui reste. Il ne
remplace pas `docs/PASSATION-MOTEUR.md`, qui reste l'autorité sur le moteur.

## Lancer

```bash
python tools/serve.py            # sert la racine sur :8000, double pile
```

Puis `http://localhost:8000/`. Sur un téléphone du réseau local, l'adresse est
affichée au démarrage du serveur.

## Les recettes

Toutes importent réellement les modules ou pilotent réellement la page. Aucune
ne vérifie du code par expression régulière — un banc qui ment est pire
qu'aucun banc.

```bash
node tools/recette-homographie.mjs   # l'homographie a N reperes, hors navigateur
node tools/recette-sequences.mjs     # la carte, les raccords, les pistes, les traversees
node tools/recette-parcours.mjs      # FAIT DEFILER le vrai site et regarde ce qui sort
node tools/recette-son.mjs           # ENTRE AVEC LE SON et mesure le bus principal
node tools/mesure-chargement.mjs     # LCP et premiere image, en 4G lente simulee
```

Les quatre recettes passent intégralement au moment d'écrire ces lignes.

## Ce qui est mesuré

| | Mesure | Cible | |
|---|---|---|---|
| Poids images, bureau 1280 | **172,66 Mo** | 250 Mo plafond | sous le plafond, plus léger que Parkside (224) |
| Poids images, mobile 854 | **101,51 Mo** | 150 Mo cible | confortablement dessous |
| Rapport mobile / bureau | **59 %** | | la surface n'en fait que 44 % |
| JS + page, compressés | **96,2 ko** | 250 ko budget | 62 % du budget non consommé |
| Audio livré | **14,37 Mo** | 29,05 sur Parkside | dix-sept pistes |
| Audio **une fois décodé** | **249 Mo** | jamais mesuré ailleurs | c'est lui qui compte, pas le poids du fichier |
| LCP, 4G lente simulée | **1,95 s** | < 2,5 s | |
| Première image peinte | **2,54 s** | < 3 s | |
| Parcours total | **85 hauteurs d'écran** | | 76 500 px à 900 px d'écran |
| Images par seconde, matériel réel | **NON MESURÉ** | 30 sur téléphone | voir plus bas |

### Ce qui reste à mesurer, et pourquoi je ne peux pas le faire seul

Le plancher de **30 images par seconde sur un vrai téléphone**. Les temps
relevés sans tête sont pris sous rendu logiciel : la page y tourne à 24 img/s
et bascule d'elle-même en mode dégradé, ce qui prouve que le mécanisme marche
mais ne dit rien du matériel réel.

Pour la faire : lancer le serveur, ouvrir l'adresse du réseau local sur le
téléphone, et **lire le témoin en bas à gauche**. Il affiche la cadence
instantanée et le pire creux glissant. Il passe au rouge sous 30 img/s et à
l'orange si le mode dégradé s'enclenche, avec sa raison. Défiler tout le
parcours, s'attarder sur la salle de vélos — deux fois plus dense en images que
les autres — et sur la piscine, seul écran WebGL.

## Ce qui est fait

**La chaîne d'images.** Treize clips extraits et encodés en deux jeux. Deux
adaptations par rapport à Parkside, imposées par la matière : `frames.sh` lit
désormais la cadence source au lieu de la supposer à 24 (le spa est à 30), et
`build-frames.sh` redimensionne le jeu 1280 quand la source est plus large (le
spa est en 1920).

**Les qualités d'encodage** sont posées sur une mesure du risque de bandes qui
cherche les images les plus difficiles de chaque clip, et non des images prises
au milieu. Le pire cas est le hall à 95,3 % de zones sombres et lisses sur sa
dernière image — deux fois et demie le pire cas de Parkside.

**Les raccords** sont mesurés, pas décidés. Quatre jonctions sont directes :
01→02, 06→07, 10→11, 11→12, entre 1,1× et 4,5× l'étalon avec un SSIM de 0,73 à
0,98. Les huit autres sont entre 5,2× et 12,6× avec un SSIM de −0,05 à 0,48. La
séparation est franche et sans recouvrement.

**Le noir du spa** est un événement et non un raccord : extinction jusqu'au noir
avec tenue, rallumage sur les vélos, `fonduEnchaine: 0` — les trois ensemble.
Vérifié au banc, en poussant la vraie molette : la luminosité descend en onze
paliers de 1,00 à 0,00, **tient le noir sur quatre relevés**, et les vélos
remontent 0,26 → 1,00.

**La mise en route** est mesurée aussi. Une seule jonction montre un vrai saut
de vitesse — 01→02 à 15,5× — et une seule séquence porte donc `miseEnRoute`. En
poser ailleurs freinerait une caméra déjà lancée.

**L'eau.** Homographie à N repères, coins relevés à la main sur la première et
la dernière image. Le plan ne translate pas — corrélation de phase à 5 px de
cumul sur 133 images — mais il **zoome en arrière** d'environ 6 %, ce que des
coins figés ne sauraient pas suivre. Les constantes de simulation sont recopiées
à la valeur près ; `REFRACTION` à 0,07 et `AMPLI_PENTE` à 4,0.

**L'éclairage de l'eau a été remesuré**, et il diffère de Parkside sur un point
important : **ce plan n'a aucune traînée de soleil sur l'eau**. Vérifié en
cartographiant `rouge moins bleu` sur les 133 images — l'intérieur du
quadrilatère reste neutre puis bleu du début à la fin. `ECLAT_SOLEIL` est donc à
zéro partout, comme la §7.5 le prévoit pour ce cas. Le terme nocturne, lui, est
mesuré sur le rapport entre la luminance du bassin et celle de sa terrasse — un
signal insensible au niveau général de lumière, contrairement à `bleu moins
rouge` qui se fait piéger par le crépuscule où toute la scène devient bleue. Les
projecteurs entrent à t = 0,52 et sont pleins à t = 0,86.

**Aucun occultant** : rien ne traverse la ligne d'eau sur ce plan.

## La couche sonore

**Les courbes viennent de Parkside et ne sont pas retouchées.** Noverre a été
construit pour coller à sa timeline, et ces courbes ont été réglées à l'oreille
sur plusieurs jours. Une seule différence, celle du §6.8 : le site n'est pas en
centre-ville. `ville-proche` est retirée — ses événements identifiables sont ce
qui fait entendre un centre-ville, et elle ne se baisse pas, elle se retire.
`ville-lointaine` devient `lointain`, `ville-interieure` devient
`lointain-interieur`, et le bar devient le restaurant.

**Le §6.8 prescrivait un `lowpass=f=1200` sur le lointain : il ne sert à rien
ici.** Mesuré, le fichier y est déjà — f99 à 1050 Hz et **0,0 %** d'énergie
au-dessus de 4 kHz. Le filtrer ne lui retirerait rien, et le ré-encoder lui
coûterait une génération sur un matériau qui n'a plus de master. Il est renommé,
pas retouché. Aucune piste n'est ré-encodée, pour la même raison.

**Une piste ne vient pas de Parkside : `foret-jour`.** Elle comble le trou
laissé par `ville-proche`, qui montait là-bas jusqu'à −8 en fin de première
séquence et y était l'élément extérieur le plus fort de la page. Sans elle, le
lever du jour finissait dans le vide — le jour s'installait et l'on n'entendait
plus rien. Elle reprend exactement sa courbe, et c'est aussi ce qu'on entend en
sortant des fenêtres : ce bâtiment donne sur des arbres, pas sur une rue.
Mesurée à 8 % d'énergie au-dessus de 4 kHz, gardée à son débit d'origine parce
qu'elle est filtrée en temps réel.

**La couche à aigus que le §6.8 exige existe déjà : `parc-jour`, à 21 %
d'énergie au-dessus de 4 kHz.** C'est elle qui donne prise au scellement, et
c'est mesuré, pas supposé. Pour comparaison, `vent` est à 0,1 % et `lointain` à
0,0 % : ni l'un ni l'autre ne pourrait tenir ce rôle. Une prise de feuillage
dédiée renforcerait la démonstration, mais elle n'est pas nécessaire.

**Les deux traversées de façade partagent une seule instance.** Noverre sort
deux fois du bâtiment — par le vitrage de la salle de sport, par la baie du
balcon — et chaque excursion enjambe deux segments. Quatre instances tomberaient
dans le piège du §6.7 : la banque ne route une piste vers un filtre qu'à sa
création, donc les trois dernières récupéreraient `parc-jour` déjà branché sur
le filtre de la première, et leur scellement n'aurait aucun effet. Symptôme :
une des fenêtres ne s'entend pas se fermer, et ça se diagnostique très mal à
l'oreille. La parade est celle que le §6.7 donne en premier — une instance, deux
couples de seuils — et l'instance reçoit un **axe d'images global** pour qu'une
excursion à cheval sur deux segments garde un intervalle monotone.

**Les quatre seuils sont relevés à l'œil, sur l'image :**

| Excursion | Sortie | Retour | |
|---|---|---|---|
| jardin | `06` image 96 | `07` image 60 | une vitre : événement à une image |
| parc | `10` image 26 | `11` image 80 | **baie ouverte** : le dehors entre déjà |

**La baie du balcon est ouverte, et ça change le mécanisme.** Les coulissants
sont écartés, on le voit à l'image dès la première. Le dehors entre donc déjà,
atténué de 16 dB, et monte à mesure qu'on s'en approche ; le franchissement lui
donne le dernier cran au lieu de tout donner d'un coup. La traiter comme une
vitre serait faux dans les deux sens — on verrait une baie ouverte sans rien
entendre, puis tout arriverait d'un bloc sur un seuil que rien ne matérialise.

**La porte est celle de Parkside, à l'identique.** `porte.js` et `vumetre.js`
sont copiés à l'octet près, le balisage porte les mêmes éléments et le CSS les
mêmes règles. Deux choses seulement diffèrent, et elles tiennent au
mot-symbole : NOVERRE est long et fin — rapport d'encre 6,90 contre 3,21 — donc
le flou d'ouverture passe de 28 à **22**. Rendu et regardé à mi-amorce, 28 ne
donnait pas un mot qu'on devine mais **une simple tache**, précisément le défaut
que la valeur d'origine cherchait à éviter. Le minutage, lui, ne bouge pas d'un
dixième : il est calé sur `logo.mp3`, et c'est le même fichier — vérifié, le
flou atteint zéro à 6,0 s, exactement sur le drop.

## Trois défauts trouvés et corrigés

**Le dehors redevenait « intérieur » au milieu d'une excursion.** On sortait par
le vitrage de la salle de sport, on entendait le dehors, et deux secondes plus
tard — au passage dans le yoga — tout se refermait alors qu'on était encore
dehors. Cause : quatre scènes déclarent `parc-jour`, `lointain` ou `vent` dans
leurs couches, et `scenesBasculer` appelle `taire()` sur toutes les scènes qui
ne sont pas la courante, ce qui poussait ces pistes à −60 **à chaque
franchissement de frontière**. Or une excursion enjambe justement une frontière,
et la traversée ne ré-affirmait rien puisque son état, lui, n'avait pas changé.
Elle ré-affirme désormais ses niveaux à chaque trame, exactement comme le
mélangeur le fait pour les couches ordinaires. La recette le surveille en
mesurant les **aigus** de part et d'autre de la frontière — c'est le bon signal,
puisque le scellement coupe au-dessus de 200 Hz.

**Le curseur disparaissait pour de bon.** `pointerleave` et `blur` le masquent,
à juste titre, mais il n'était rallumé que dans un `if (!vu)` vrai une seule
fois. Le premier passage sur un autre onglet le faisait donc disparaître
définitivement — et comme le curseur natif est masqué par `cursor: none`, il ne
restait plus rien du tout à l'écran.

## Un défaut d'image trouvé et corrigé

En quittant la piscine pour l'écran des faits, l'orchestration rendait la main
au canvas 2D — lequel tenait encore **la piscine en plein jour**, la dernière
image qu'il eût peinte avant que le bassin WebGL ne prenne le relais. Le noir
des faits ne s'installant que sur les 16 % premiers du segment, on voyait
pendant une demi-hauteur d'écran le plan repasser de la nuit au jour.

Il n'y avait rien à échanger : l'écran des faits est un voile opaque, et ce
qu'il couvre doit rester ce que le visiteur regardait à l'instant d'avant. La
recette le surveille désormais — une fois la nuit tombée, plus aucun relevé ne
doit remonter.

## Ce qui n'est pas fait, et c'est voulu

**Les textes.** `titre`, `texte`, les lignes de l'écran final, les libellés de
la porte, le titre et la description de la page. Rien n'est inventé : une phrase
inventée sur une pièce de référence se remarque plus qu'une phrase absente. Les
emplacements existent et sont à `null`.

**L'icône du site.** `<link rel="icon" href="data:,">` coupe la requête pour ne
pas récolter un 404 à chaque chargement. La vraie icône viendra avec les
éléments de marque — le mot-symbole, lui, est arrivé et est en place.

## La mémoire sur téléphone, et pourquoi le site y buguait

Le site s'arrêtait de charger et ramait sur iPhone et iPad. Ce n'était pas le
réseau. Deux causes, toutes deux mesurées, et **aucune des deux n'était visible
dans le poids des fichiers**.

**Le son décodé pesait 648 Mo.** Une piste occupe `durée × 48000 × canaux × 4`
octets une fois décodée, quel que soit son poids en MP3 : le décodage multiplie
par vingt-et-un. Les dix-sept pistes faisaient 31 Mo sur le disque et 648 en
mémoire, tout décodé au clic sur la porte — mesuré dans le navigateur, 11,5 s de
décodage cumulé et la dernière piste prête 8,5 s après le clic. La passation ne
chiffre que la mémoire des images (§10.3), jamais celle du son.

Neuf pistes sur dix-sept dépassaient les 60 à 90 s que la §6.5 prescrit, dont
`eau` à **555 secondes**. Elles sont ramenées à 90, avec un raccord qui rend la
boucle continue, et les nappes diffuses passent en mono — le site les place au
gain, jamais au panoramique, donc leur stéréo ne portait rien. **648 → 249 Mo**,
sans perte audible : les raccords de boucle sont mesurés, tous sous 5× le saut
d'échantillon typique.

**Et le téléphone recevait le jeu d'images du bureau.** Le seuil était
`besoin <= 854`. Un iPhone de 430 px CSS a un rapport de pixels plafonné à 2,
donc un besoin de 860 : **six pixels de trop**, et il basculait sur le jeu 1280.
Une image de 1280 décodée occupe 3,52 Mio contre 1,56 — trois anneaux passaient
de 187 à 422 Mo, pour 0,7 % de netteté que personne ne peut voir. Une tolérance
de 15 % corrige ça sans toucher aux tablettes, qui gardent le jeu bureau.

| | avant | après |
|---|---|---|
| iPhone 430 px | 422 + 648 = **1 070 Mo** | 187 + 249 = **436 Mo** |
| iPad | 422 + 648 = **1 070 Mo** | 422 + 249 = **671 Mo** |

**Un levier non tiré, et c'est votre décision.** Abaisser la fréquence du
contexte audio à 32 kHz diviserait encore le son par 1,5 — 249 → 166 Mo. Mesure
faite : la forêt monte à 19,4 kHz au seuil de 99,9 % de son énergie, donc un
plafond à 16 kHz lui couperait du contenu réel. Inaudible pour la plupart des
oreilles, mais c'est un arbitrage de qualité sonore et il ne se prend pas seul.

## Deux points à surveiller

**`vent.mp3` fait 45 secondes**, sous le minimum de 60 à 90 du §6.5. C'était
validé sur Parkside **parce que** le vent y était enterré entre −16 et −30 sous
la ville. Ici la ville est retirée et le lointain est plus discret : le vent est
donc plus exposé, et le §6.8 prévient explicitement qu'il « va se mettre à
boucler ». C'est le premier point à vérifier à l'oreille, et une prise plus
longue serait la vraie réponse.

## Un point de montage à surveiller

`01 → 02` est le plus lâche des quatre raccords directs : écart 32,9 contre 8,1
pour le plus serré, SSIM 0,734 contre 0,982. La caméra a avancé entre les deux
plans et la façade est sensiblement plus grosse à l'entrée du 02. C'est à juger
en mouvement. Si ça saute, le remède n'est pas de chercher une meilleure image
de raccord — une recherche exhaustive sur la pire jonction de Parkside n'a gagné
que 1 % — mais de lui rendre un fondu très court.
