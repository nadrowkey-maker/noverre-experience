# Le son de Noverre

Le site est fini, il ne reste que le son. Les mp3 sont dans le dossier audio.

Tu as déjà `PASSATION-MOTEUR.md`. **Relis les sections 6.1 à 6.8 en entier avant
d'écrire une ligne.** Ce document-ci ne les remplace pas, il dit ce qui est
particulier à Noverre.

---

## Le fait central : la bande sonore de Parkside se transpose presque telle quelle

Noverre a été construit **exprès** pour coller à la timeline sonore de Parkside.
Même arc de lumière, mêmes lieux, dans le même ordre :

```
nuit (ecran d'entree)  ->  lever du jour  ->  on rentre  ->  hall  ->  spa
   ->  velos  ->  ...  ->  coucher  ->  nuit
```

C'est vérifiable dans la configuration de Parkside. La première séquence,
« The First Day », est déjà un lever de jour :

```js
'parc-nuit':       { debut: -14, fin: -60 },
'parc-jour':       { debut: -60, fin: -16, bosse: 0.35, dbBosse: -11 },
'ville-lointaine': { debut: -60, fin: -14 },
'ville-proche':    { debut: -60, fin: -8, retard: 0.45 },
```

et l'écran d'entrée tourne sur `{ 'parc-nuit': -20 }` — les insectes de la nuit
sous les deux boutons. Le toit referme sur les mêmes insectes à minuit.

**Conséquence pratique, et c'est le point le plus important de ce document :**
les blocs `couches` de Parkside se **recopient séquence par séquence**, avec
leurs valeurs, leurs `bosse`, leurs `retard` et leurs croisements. Ce n'est pas
du contenu à réinventer ici. Ces courbes ont été réglées à l'oreille sur
plusieurs jours et elles tombent juste sur cette timeline.

**Ne les « améliore » pas. Ne les arrondis pas. Ne les recalcule pas.** Copie,
fais tourner, et on ajustera ensemble à l'oreille.

---

## Les trois seules choses qui changent

### 1. Il y a PLUSIEURS traversées de fenêtre, là où Parkside n'en a qu'une

C'est la vraie différence. **Lis le §6.7 en entier**, il contient le module
complet.

La doctrine, à ne pas rater : **franchir une vitre est un événement à UNE IMAGE,
jamais une courbe sur le segment.** Si tu écris `{ debut: -60, fin: -10 }` sur
les pistes extérieures et que tu laisses le défilement les monter, on entend les
oiseaux et la route **à travers le verre fermé**, et la démonstration
d'isolation acoustique s'effondre exactement là où elle devait culminer. Trois
états discrets, bascule à l'image.

Le module `behaviours/traversee.js` se copie intégralement. Pour chaque scène qui
sort du bâtiment, déclare un bloc :

```js
traversee: {
  sortie: IMAGE_SORTIE_VITRE_<SCENE>,     // constante NOMMEE, jamais un nombre
  retour: IMAGE_RENTREE_VITRE_<SCENE>,
  dehors: { /* ce qu'on entend une fois dehors, a plein niveau */ },
  dbDehorsAvant: -60,     // ces memes pistes tant qu'on est derriere la vitre
  dbDedans: -46,
  dbVilleInterieure: -36, // ce qui reste une fois la piece refermee
},
```

**Le piège qui va te mordre, et qui se diagnostique très mal à l'oreille.**
La banque ne route une piste vers un filtre qu'**à sa création** :

```js
async function obtenir(nom, sortie = null) {
  if (nappes.has(nom)) return nappes.get(nom);   // `sortie` est IGNORE
```

Si deux traversées déclarent la même piste dans leur `dehors`, la seconde la
récupère **déjà branchée sur le filtre de la première**, et son scellement à elle
n'a aucun effet. Symptôme : une des deux fenêtres ne s'entend pas se fermer.

Préfère des **pistes distinctes par façade** — `dehors-nord`, `dehors-cour`,
`dehors-jardin`. C'est de toute façon plus juste : deux côtés d'un bâtiment ne
sonnent pas pareil, et ça règle le problème sans refonte.

Choisis le contenu de `dehors` selon la **hauteur** de la scène. Depuis un étage
on n'entend pas une rue en détail : ni pas, ni portières, ni voix, seulement une
masse diffuse et essentiellement grave.

**Les seuils sont des constantes nommées.** Ce sont des valeurs qu'on réglera à
l'image près en regardant, pas en calculant depuis le minutage.

### 2. Le site n'est pas en centre-ville

Parkside est à Brickell, en plein Miami. Noverre ne l'est pas. **Lis le §6.8.**

Ne te contente pas de baisser le gain des pistes de ville : ça ne marche pas. Un
lointain n'est pas un fort baissé — ce qui change avec la distance c'est le
spectre avant le niveau, et une ville à −35 dB garde ses passages de voiture et
ses klaxons.

En résumé de ce que dit le §6.8 :

- l'équivalent de `ville-proche` **se retire**, il ne se baisse pas ;
- l'équivalent de `ville-lointaine` se garde, **ré-encodé passe-bas**
  (`lowpass=f=1200`, puis 64 kbit/s) et renommé honnêtement ;
- **il faut une couche extérieure qui a des aigus** — du feuillage dans le vent.
  Sans elle, ni les fenêtres ni les traversées ne s'entendent, parce que le
  scellement coupe au-dessus de 200 Hz et qu'il n'y aurait rien à couper. C'est
  l'argument commercial du site, il ne peut pas tomber.

Le reste des courbes ne bouge pas. C'est un ajustement de palette, pas une
refonte du mix.

### 3. La table `PISTES` est à écrire

Le moteur ne connaît que des **noms**. Toute piste citée dans une `couche`, un
`declencheur` ou un `dehors` doit figurer dans `config/audio.js`, sinon
`banque.obtenir` lève `piste inconnue`.

Prends les noms de Parkside quand le rôle est le même — ça rend la copie des
`couches` littérale — et ne renomme que ce qui a changé de nature.

N'oublie pas les **sons déclenchés à l'unité** (`unique: true`) : Parkside en a
deux, la masse d'air d'un franchissement et un événement de hall. Ils passent par
`one-shots.js`, portent un verrou anti-répétition et un `effacer(tau)` pour que
leur traîne ne déborde pas sur la scène suivante.

---

## L'ordre de travail

1. Remplir `config/audio.js`. Vérifier que **chaque** nom cité existe.
2. Copier les `couches` de Parkside, séquence par séquence, sans rien changer.
3. Copier `behaviours/traversee.js` et déclarer un bloc par scène qui sort.
   Vérifier tout de suite le partage de pistes entre traversées.
4. Appliquer l'ajustement de palette du §6.8.
5. Faire tourner. Me dire ce qui sonne faux — **ne corrige pas de toi-même les
   niveaux** au premier passage, on les ajustera ensemble.

Si `tools/recette-son.mjs` a été repris, fais-le passer : il vérifie les
comportements sonores sur des critères, pas à l'oreille.

---

## Ce qu'il ne faut pas faire

**Ne touche à aucune constante de `constants.js`.** `TAU_GAIN`,
`SCELLEMENT_T_FILTRE`, `SCELLEMENT_T_VOLUME`, `TRAVERSEE_T_ALLER`,
`SCELLEMENT_FILTRE_OUVERT` et `SCELLEMENT_FILTRE_FERME` sont du ressenti déjà
réglé. C'est l'écart entre le filtre et le volume qui produit la sensation de
vitre, pas leurs valeurs prises séparément.

**Ne pilote jamais une tête de lecture avec le défilement.** Les nappes tournent
en permanence, le défilement ne pilote que des gains et des filtres. C'est la
règle qu'on ne casse pas.

**Tout en décibels, jamais en linéaire.** `-60` vaut silence. La seule exception
de tout le site est le gain de l'eau du bassin.

**Une piste ne se duplique jamais.** Un seul enregistrement joué à des niveaux
différents selon la scène : c'est ce qui fait entendre un lieu plutôt qu'une
collection de scènes.

**Aucun son ne démarre sans clic explicite.**

Si quelque chose te paraît devoir dévier de tout ça, **dis-le avant de le coder**.
