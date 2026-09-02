# PASSATION — LE MOTEUR

Ce document décrit le moteur d'un site de visite architecturale piloté au
défilement, écrit pour **Parkside** (BI Group, Brickell, Miami) et destiné à être
reconstruit à l'identique pour un autre bâtiment, avec d'autres clips et d'autres
sons.

Il est écrit pour quelqu'un de compétent qui n'a jamais vu le dépôt d'origine et
qui doit livrer en trois jours.

### Sommaire

| | | |
|---|---|---|
| 0 | [Comment lire ce document](#0-comment-lire-ce-document) | la règle des deux catégories |
| 1 | [Machine ou contenu, fichier par fichier](#1-machine-ou-contenu-fichier-par-fichier) | ce qui se copie, ce qui se réécrit |
| 2 | [La chaîne de production des images](#2-la-chaîne-de-production-des-images) | commandes ffmpeg, dimensions, qualité |
| 3 | [Le moteur de défilement](#3-le-moteur-de-défilement) | reproduit intégralement, constantes expliquées |
| 4 | [L'anneau d'images et le préchargement](#4-lanneau-dimages-et-le-préchargement) | modèle mémoire, alimentation des voisins |
| 5 | [La carte des séquences et les raccords](#5-la-carte-des-séquences-et-les-raccords) | rythme, fondus, ce qu'on voit quand on se trompe |
| 6 | [La couche sonore](#6-la-couche-sonore) | doctrine, scellement, **traversée de vitre**, palette hors ville |
| 7 | [L'eau en WebGL](#7-leau-en-webgl) | **homographie variable**, éclairage nocturne |
| 8 | [L'outil de calage des coins](#8-loutil-de-calage-des-coins) | ce qu'il fait, ce qu'il produit |
| 9 | [Les pièges déjà rencontrés](#9-les-pièges-déjà-rencontrés) | **34 défauts, symptôme et cause** |
| 10 | [Les chiffres mesurés](#10-les-chiffres-mesurés) | poids, débit, mémoire, et ce qui n'a pas été mesuré |
| 11 | [L'ordre de travail, pour trois jours](#11-lordre-de-travail-pour-trois-jours) | |

**Si vous ne lisez que deux sections** : la 9, qui vous fera gagner le plus de
temps, et la 7.4, qui est la seule vraie différence de conception avec Parkside.

---

## 0. Comment lire ce document

**Toutes les constantes citées ici ont été copiées du code au moment de la
rédaction**, pas de mémoire. Les chemins ont été vérifiés, les tailles mesurées
sur le disque, et le code neuf de la section 7 a été exécuté avant d'être écrit.

Deux avertissements qui valent pour tout le reste :

**Les constantes de ressenti ne se réinventent pas.** L'amortissement du
défilement, les gains molette et tactile, les constantes de lissage audio et les
constantes de la simulation d'eau ont été réglées à la main contre l'oreille et
contre l'œil, sur plusieurs jours. Les recopier prend une minute ; les
retrouver prend une semaine. Copiez-les, faites tourner le site, et ne les
touchez qu'après avoir constaté un défaut précis.

**Deux catégories, et il ne faut jamais les confondre** : la MACHINE, qui se
recopie ; le CONTENU de Parkside, qui ne se recopie pas et ne sert que d'exemple
de remplissage. La section 1 tranche fichier par fichier.

---

## 1. Machine ou contenu, fichier par fichier

`M` = machine, se recopie. `M!` = machine, mais contient des valeurs à changer.
`C` = contenu Parkside, à réécrire entièrement — ne sert que d'exemple.

### `src/config/`

| Fichier | | Quoi faire |
|---|---|---|
| `constants.js` | `M!` | Copier intégralement. **Ne changer que la section « L'ouverture »** (minutage de l'amorce, calé sur `logo.mp3` de Parkside — voir §6.6). Tout le reste est du ressenti déjà réglé. |
| `sequences.js` | `C` | Réécrire entièrement. Seule la **forme** se recopie : la liste d'objets, les noms de champs, la structure de `couches`. Les valeurs sont du contenu. |
| `audio.js` | `M!` | La structure et `ROGNAGE_BOUCLE` se copient. La table `PISTES` est un contrat d'interface à réécrire (§6.5). |
| `eau.js` | `M!` | Les constantes de simulation (§7.2) se copient **à la valeur près**. Les tables `MIROITEMENT`, `ECLAT_SOLEIL`, `ECLAT_NUIT` sont propres à la piscine de Parkside : à remesurer (§7.5). |
| `bassin.js` | `C` | Coins et occultants relevés à la main sur la piscine de Parkside. À refaire avec l'outil de la §8. La fonction `reechantillonner` est de la machine et se copie. |

### `src/scroll/`, `src/frames/`, `src/quality/`

| Fichier | | |
|---|---|---|
| `scroll/smooth-scroll.js` | `M` | Copie intégrale. Reproduit en §3. |
| `scroll/sequence-map.js` | `M` | Copie intégrale. |
| `src/frames/frame-source.js` | `M` | Copie intégrale. |
| `src/frames/frame-ring.js` | `M` | Copie intégrale. Reproduit en §4. |
| `src/frames/prefetch.js` | `M` | Copie intégrale. Reproduit en §4. |
| `src/frames/frame-renderer.js` | `M` | Copie intégrale. |
| `src/frames/transitions.js` | `M!` | Copier la fonction. Le commentaire d'en-tête liste les raccords de Parkside : à réécrire. |
| `quality/degraded.js` | `M` | Copie intégrale. |

### `src/audio/`

| Fichier | | |
|---|---|---|
| `graph.js` | `M` | Contexte, bus, amorce. Copie intégrale. |
| `tracks.js` | `M` | Copie intégrale. |
| `seal.js` | `M` | Le scellement. Copie intégrale. |
| `one-shots.js` | `M` | Copie intégrale. |
| `scene.js` | `M` | Le mélangeur. Copie intégrale, **sauf** les trois lignes qui appellent les comportements propres (`traversee`, `rideau`, `eau`) et le bloc `tairAvantLaVille`, qui sont des crochets de contenu. |
| `behaviours/eau.js` | `M` | Copie intégrale si le nouveau site a un bassin. |
| `behaviours/rideau.js` | `C` | Mécanisme réutilisable, contenu Parkside. |
| `behaviours/traversee.js` | `M!` | **Copie intégrale** si la caméra sort du bâtiment. Reproduit et expliqué en §6.7. Seuls les seuils et les niveaux sont du contenu. |
| `behaviours/velos.js` | `C` | Idem. |

Les trois derniers sont des **exemples de la forme qu'un comportement propre
prend** : une fonction `creer…(config, banque)` qui rend un objet avec `suivre()`
et `taire()`, appelée depuis `scene.js`. Le nouveau site aura les siens, qui ne
seront pas ceux-là.

### `src/water/`

| Fichier | | |
|---|---|---|
| `simulation.js` | `M` | Copie intégrale. C'est le cœur, il ne se retouche pas. |
| `shaders.js` | `M!` | Les quatre premiers shaders : copie **mot pour mot** (§7.3). `FRAGMENT_SURFACE` : copie, puis adapter l'éclairage nocturne (§7.6). |
| `homographie.js` | `M!` | Copier `carreVers` et `inverser` tels quels. **Remplacer `versUnite`** par la version à N repères (§7.4). |
| `bassin.js` | `M!` | Copier, puis brancher la nouvelle homographie et le nouvel uniform de nuit. |

### `src/ui/`

| Fichier | | |
|---|---|---|
| `curseur.js` | `M` | Copie intégrale. |
| `vumetre.js` | `M` | Copie intégrale. |
| `porte.js` | `M!` | La mécanique se copie. Le minutage vient de `constants.js` et dépend du fichier son de l'amorce. |
| `faits.js` | `M` | L'écran final. Copie intégrale, le texte vient de `sequences.js`. |
| `main.js` | `M!` | L'orchestration se copie. Les branchements de contenu — quels segments ont un bassin, une traversée, un rideau — sont à revoir. |

### `tools/`

| Fichier | | |
|---|---|---|
| `serve.py` | `M` | Copie intégrale. **Ne le réécrivez pas** (§9, piège 1). |
| `frames.sh`, `encode.sh` | `M` | Copie intégrale. |
| `build-frames.sh` | `M!` | La chaîne se copie ; la table `CONFIG` est du contenu. |
| `editeur-bassin.html` | `M!` | À adapter pour N repères (§8). |
| `recette-*.mjs` | `M` | Bancs d'acceptation. Copie intégrale. |
| `banc-bassin.html`, `rendu-bassin.html` | `M` | Bancs de l'eau. Copie intégrale. |
| `controle-grille.html`, `controle-curseur.html` | `M` | Contrôles de mise en page et de contraste. |

### Racine

`index.html` est `M!` : le squelette, la grille CSS et les règles de la §9
piège 8 se copient ; les textes, les métadonnées et le JSON-LD sont du contenu.
`vercel.json` est `M`. `.gitignore` et `.vercelignore` sont `M` et **importants** :
le second empêche de servir publiquement les documents de travail internes.

`CLAUDE.md`, `PLAN.md`, `docs/` sont du contenu Parkside.

---

## 2. La chaîne de production des images

### 2.1 Le principe, et pourquoi il n'est pas négociable

**On n'utilise jamais `<video>` avec un `currentTime` piloté par le défilement.**
Le seek vidéo est irrégulier sur iOS Safari, et la moitié des acheteurs sont sur
un téléphone. Chaque clip devient une **séquence d'images**, et l'index d'image
est une fonction de la position du défilement.

### 2.2 Arborescence

Source, hors dépôt :

```
rushes/01-facade.mp4
rushes/02-seuil.mp4
...
```

Intermédiaire, jeté après usage :

```
build/frames-png/<clip>/0001.png ...
```

Livrable, versionné et servi :

```
frames/webp-1280/<clip>/0001.webp ...
frames/webp-854/<clip>/0001.webp ...
```

**Nommage** : quatre chiffres, base 1, extension du format. Le code construit
l'URL ainsi (`src/frames/frame-source.js`) :

```js
const url = (i) =>
  `${FRAMES_BASE()}/${idSequence}/${String(i).padStart(4, '0')}.${FRAMES_EXT}`;
```

`FRAMES_BASE()` vaut `/frames/webp-1280` ou `/frames/webp-854` selon l'appareil,
choisi **une seule fois** au démarrage (`src/config/sequences.js`) :

```js
export function choisirJeu({ forcerMobile = false } = {}) {
  if (jeuChoisi) return jeuChoisi;
  const rapport = Math.min(window.devicePixelRatio || 1, 2);
  jeuChoisi = (forcerMobile || window.innerWidth * rapport <= 854) ? 854 : 1280;
  return jeuChoisi;
}
export const FRAMES_BASE = () => `${RACINE}/${FRAMES_EXT}-${choisirJeu()}`;
```

Les images sont à la **racine** du dépôt, pas sous `public/` : le chemin servi
doit être `/frames/...` pour que les en-têtes de cache de `vercel.json` le visent.

### 2.3 Extraction : rush vers PNG

`tools/frames.sh`, copiable tel quel :

```bash
#!/usr/bin/env bash
set -euo pipefail
CLIP="${1:?usage: frames.sh <clip-sans-extension> <img/s>}"
FPS="${2:?usage: frames.sh <clip-sans-extension> <img/s>}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/rushes/$CLIP.mp4"
OUT="$ROOT/build/frames-png/$CLIP"
[ -f "$SRC" ] || { echo "introuvable : $SRC" >&2; exit 1; }

SRC_FPS=24
case "$FPS" in
  24) STEP=1 ;; 12) STEP=2 ;; 8) STEP=3 ;; 6) STEP=4 ;;
  *)  echo "img/s doit diviser $SRC_FPS : 24, 12, 8 ou 6" >&2; exit 1 ;;
esac

rm -rf "$OUT"; mkdir -p "$OUT"
ffmpeg -v error -i "$SRC" \
  -vf "select=not(mod(n\,$STEP))" -vsync 0 \
  "$OUT/%04d.png"
```

Deux points qui comptent :

`select=not(mod(n\,STEP))` garde une image sur `STEP` en partant de l'index 0.
`-vsync 0` **empêche ffmpeg de réinventer une cadence** et de dupliquer des
images : on veut exactement les images choisies, une pour une. Sans lui, un
`-r 12` produirait des doublons et le scrub aurait des paliers invisibles à la
lecture mais bien présents au défilement lent.

On ne réencode jamais l'image ici : on la sort telle que le décodeur la rend.

### 2.4 Encodage : PNG vers les deux jeux

`tools/build-frames.sh` fait la chaîne complète. Le cœur, pour une image :

```bash
# Jeu bureau, 1280, sans redimensionnement
ffmpeg -v error -y -i "$f" -c:v libwebp -quality "$q" -preset picture "$OUT/$b.webp"

# Jeu mobile, 854
ffmpeg -v error -y -i "$f" -vf "scale=854:-2:flags=lanczos" \
       -c:v libwebp -quality "$q" -preset picture "$OUT/$b.webp"
```

Le parallélisme est indispensable : une image est indépendante de ses voisines.

```bash
JOBS=$(nproc 2>/dev/null || echo 4)
n=0
for f in "$PNG"/*.png; do
  b=$(basename "$f" .png)
  ffmpeg ... &
  n=$((n+1)); [ $((n % JOBS)) -eq 0 ] && wait
done
wait
```

La table de configuration de Parkside, **contenu, à réécrire** — format
`clip:images par seconde:qualité` :

```
01-facade:12:95
02-seuil:12:82
03-comptoir:12:95
04-spa:12:82
05-velos:24:82
06a-salle-sport:12:82
06b-mur-yoga:12:82
07-appartement:12:95
08-traversee-chambre:12:82
09a-bar:12:92
09b-bar:12:82
10-toit:12:95
```

### 2.5 Les dimensions, et d'où elles viennent

**La source fait 1280 × 720 et c'est un plafond.** Rien ne peut être réagrandi
sans dégât.

**854 découle du plafond de rapport de pixels à 2**, qui est la vraie décision.
Sur une bande 16:9 de 390 px CSS (un iPhone), un rapport de 2 réclame 780 pixels
d'appareil ; 854 laisse 9 % de marge. Un rapport de 3 réclamerait 1170 pixels,
soit 91 % du jeu bureau pour une image de la taille d'une carte de visite — et
au-delà de 2 on agrandit de toute façon.

Le jeu mobile pèse **56 % du bureau, pas 44 %** : le WebP ne suit pas le compte
de pixels, une petite image coûte plus cher au pixel. La mémoire et le décodage,
eux, suivent bien la surface — 1,56 Mio par image décodée contre 3,52.

### 2.6 Le choix du format, et la méthode

**Retenu : WebP.** Mesuré sur iPad, **à qualité appariée** (SSIM 0,969 contre
0,968) :

| Point | ko/img | Total images | Avec l'audio |
|---|---|---|---|
| AVIF crf 32 | 26,9 | 63 Mo | 108 Mo |
| WebP q 60 | 44,6 | 105 Mo | 150 Mo |

Les deux tenaient la cible, donc le poids ne départageait plus rien. Il ne
restait que le risque, entièrement du côté du **décodage** sur les appareils
qu'on ne peut pas mesurer : l'AVIF est le plus lent des deux à décoder, et le
plancher de 30 images par seconde se joue là, pas sur le réseau. S'y ajoute la
production : 4 minutes de réencodage contre 26 pour 2 412 images.

**La méthode, à retenir absolument** : n'importe quelle comparaison de poids
entre deux formats exige d'**apparier la qualité d'abord**. Un AVIF crf 40 pèse
16 ko contre 45 pour un WebP q 72 — mais à SSIM 0,950 contre 0,974. Ce n'est pas
un gain de format, c'est une baisse de qualité, et tout arbitrage bâti dessus
est faux. Cette erreur a été commise puis corrigée sur Parkside.

### 2.7 La qualité par séquence

Le critère est le **risque de bandes, pas le détail**. La part de l'image à la
fois sombre et lisse prédit l'apparition de bandes : un codec avec perte y
plafonne un dégradé sur quelques valeurs. Le détail, lui, coûte des octets mais
**masque** les défauts.

À mesurer **sur les images réellement difficiles** — l'heure bleue d'une façade,
la nuit d'un toit — et non au milieu des clips, où le risque est trois à sept
fois plus faible. Une première mesure de Parkside, prise à 2, 7,5 et 13 s, avait
manqué les vrais pires cas et donné une qualité trop basse.

Une exception mesurée : le clip du bar de Parkside n'a que 3,9 % de zones sombres
et lisses, mais un motif de chevrons fins dont la fidélité encaisse 45 % d'erreur
de plus que le reste de l'image à qualité égale. **Une statistique de zones
sombres ne voit pas ce cas** : regardez aussi les planches à 100 %.

### 2.8 Les raccords, à la concaténation

Là où la dernière image d'un clip est rigoureusement identique à la première du
suivant, **elle existe en double : supprimez-la**. Sinon le défilement marque un
palier d'une image à chaque jonction.

### 2.9 Cache

`vercel.json`, copiable tel quel :

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "headers": [
    { "source": "/frames/(.*)", "headers": [
      { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" } ] },
    { "source": "/audio/(.*)", "headers": [
      { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" } ] }
  ]
}
```

---

## 3. Le moteur de défilement

### 3.1 Le modèle

Le défilement natif est **désactivé** (`overflow: hidden; touch-action: none` sur
`html, body`). La molette et le doigt n'ont plus d'effet propre : ils ajoutent de
la vitesse à un intégrateur. La position s'obtient par intégration.

Deux filtres en série, et **c'est la paire qui produit la sensation**, pas l'un
des deux :

```
velocite  *= exp(-AMORTISSEMENT * dt)                            // la glisse
appliquee += (velocite - appliquee) * (1 - exp(-LISSAGE * dt))   // le depart
position  += appliquee * dt
```

La forme `1 - exp(-k*dt)` rend le lissage **indépendant de la cadence
d'affichage** : le même geste donne le même mouvement à 60 Hz et à 120 Hz. C'est
la même loi que `setTargetAtTime` en Web Audio, et c'est voulu — tout ce qui
glisse dans ce site glisse de la même façon.

Ce n'est **pas** du scroll-jacking dur : rien n'est contraint à un cran d'écran,
le visiteur garde un contrôle continu, peut s'arrêter, revenir, avancer très
lentement. Ce que ça coûte en revanche, c'est le **clavier**, qui n'existe plus
tout seul et doit être réimplémenté — Espace, Page suivante, les flèches, Début
et Fin. Ils passent par le même intégrateur, donc la glisse s'y applique aussi et
une touche ne produit pas un saut sec.

### 3.2 `src/scroll/smooth-scroll.js`, intégralement

```js
// Le moteur de defilement, a impulsions.
//
// Le defilement natif est desactive : la molette et le doigt n'ont plus d'effet
// propre, ils ajoutent de la vitesse a un integrateur. Deux filtres en serie
// produisent la sensation — l'amortissement fait glisser apres qu'on a lache,
// le lissage adoucit le depart — et c'est la paire qui la produit, pas l'un des
// deux.
//
// Ce que ce choix coute, et qu'il faut donc rendre : le clavier. Sans
// defilement natif, Espace, Page suivante, les fleches, Debut et Fin ne font
// plus rien, alors que le brief exige une navigation clavier complete. Ils sont
// reimplantes ici, dans le meme integrateur, pour que la glisse s'y applique
// aussi et qu'une touche ne produise pas un saut sec.

import {
  AMORTISSEMENT, LISSAGE, GAIN_MOLETTE, GAIN_TACTILE,
  IMPULSION_FLECHE, IMPULSION_PAGE, VITESSE_MAX,
} from '../config/constants.js';

export function creerDefilement({ longueurTotale }) {
  let position = 0;
  let velocite = 0;     // px/s accumules par les impulsions
  let appliquee = 0;    // px/s reellement appliques, version lissee
  let total = longueurTotale();
  let actif = false;    // rien ne bouge avant que la premiere image soit la

  function impulsion(px) {
    if (!actif) return;
    velocite = Math.max(-VITESSE_MAX, Math.min(VITESSE_MAX, velocite + px));
    // Ne rien accumuler contre une extremite : sinon le visiteur pousse dans le
    // vide et la page repart en retard quand il change de sens.
    if (position <= 0 && velocite < 0) velocite = 0;
    if (position >= total && velocite > 0) velocite = 0;
  }

  // --- molette ---------------------------------------------------------------
  function surMolette(e) {
    e.preventDefault();
    let d = e.deltaY;
    if (e.deltaMode === 1) d *= 16;                    // lignes
    else if (e.deltaMode === 2) d *= window.innerHeight; // pages
    impulsion(d * GAIN_MOLETTE);
  }

  // --- tactile ---------------------------------------------------------------
  let doigtY = null;
  const surTouchStart = (e) => { doigtY = e.touches[0].clientY; };
  function surTouchMove(e) {
    e.preventDefault();
    if (doigtY === null) return;
    const y = e.touches[0].clientY;
    impulsion((doigtY - y) * GAIN_TACTILE);
    doigtY = y;
  }
  const finDoigt = () => { doigtY = null; };

  // --- clavier ---------------------------------------------------------------
  function surTouche(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const h = window.innerHeight;
    let d = 0;
    switch (e.key) {
      case 'ArrowDown': case 'ArrowRight': d = h * IMPULSION_FLECHE; break;
      case 'ArrowUp':   case 'ArrowLeft':  d = -h * IMPULSION_FLECHE; break;
      case 'PageDown':                     d = h * IMPULSION_PAGE; break;
      case 'PageUp':                       d = -h * IMPULSION_PAGE; break;
      case ' ':                            d = (e.shiftKey ? -1 : 1) * h * IMPULSION_PAGE; break;
      // Debut et Fin sautent, ils ne poussent pas : c'est leur role.
      case 'Home': e.preventDefault(); position = 0; velocite = appliquee = 0; return;
      case 'End':  e.preventDefault(); position = total; velocite = appliquee = 0; return;
      default: return;
    }
    e.preventDefault();
    impulsion(d * GAIN_MOLETTE);
  }

  window.addEventListener('wheel', surMolette, { passive: false });
  window.addEventListener('touchstart', surTouchStart, { passive: true });
  window.addEventListener('touchmove', surTouchMove, { passive: false });
  window.addEventListener('touchend', finDoigt, { passive: true });
  window.addEventListener('touchcancel', finDoigt, { passive: true });
  window.addEventListener('keydown', surTouche, { passive: false });

  /** Avance d'une trame. Renvoie la position et la vitesse instantanees. */
  function avancer(dt) {
    velocite *= Math.exp(-AMORTISSEMENT * dt);
    if (Math.abs(velocite) < 0.5) velocite = 0;

    appliquee += (velocite - appliquee) * (1 - Math.exp(-LISSAGE * dt));
    if (Math.abs(appliquee) < 0.5 && velocite === 0) appliquee = 0;

    position += appliquee * dt;
    if (position < 0) { position = 0; velocite = appliquee = 0; }
    else if (position > total) { position = total; velocite = appliquee = 0; }

    return { position, vitesse: appliquee };
  }

  return {
    avancer,
    activer: () => { actif = true; },
    /** Le redimensionnement change la longueur : on conserve la progression. */
    remesurer() {
      const p = total > 0 ? position / total : 0;
      total = longueurTotale();
      position = p * total;
    },
    get total() { return total; },
    get position() { return position; },
  };
}
```

### 3.3 Les constantes, une par une

Toutes dans `src/config/constants.js`. **Copiez ces sept valeurs telles quelles.**

#### `AMORTISSEMENT = 2.6` (s⁻¹)

Décroissance exponentielle de la vitesse accumulée, appliquée à chaque trame.

*Au doigt* : c'est la **glisse après qu'on a lâché**. À 2,6, un coup de molette
continue de courir un peu moins d'une seconde avant de s'éteindre.

*Plus petit* (1,5) : le site patine, on lâche et ça continue longtemps ; on perd
le sentiment de tenir le bâtiment, ça devient une bande transporteuse.
*Plus grand* (5) : ça s'arrête net dès qu'on lâche, la glisse disparaît et le
défilement redevient mécanique — exactement ce que la paire de filtres cherche à
éviter.

#### `LISSAGE = 10.0` (s⁻¹)

Vitesse à laquelle la vitesse *appliquée* rejoint la vitesse *accumulée*.

*Au doigt* : c'est la **douceur du départ**. À 10, un cran de molette ne produit
pas un à-coup, le mouvement s'installe en une fraction de seconde.

*Plus petit* (4) : départ mou, retard perceptible entre le geste et l'image, on a
l'impression que le site répond mal.
*Plus grand* (25) : chaque cran de molette devient un micro-saut ; le mouvement
redevient saccadé et l'on entend presque la roue crantée.

#### `GAIN_MOLETTE = 5.0`

Conversion d'un `deltaY` en vitesse.

*Plus petit* : il faut tourner davantage pour la même distance — le geste devient
dur et fatigant. **Ce n'est pas le bon levier pour ralentir le parcours** :
allongez plutôt `ECRANS_PAR_SEQUENCE`, qui garde exactement la même glisse et
demande simplement plus de trajet.

#### `GAIN_TACTILE = 6.8`

Plus haut que la molette, et ce n'est pas une inconséquence.

Un cran de molette est presque gratuit : le doigt reste posé et la roue répète.
Un balayage demande un mouvement de main complet **et un lever**. À gain égal,
allonger le parcours de moitié faisait passer le téléphone de 78 à 119 balayages
pour la page entière, contre 225 à 342 crans au bureau : la même croissance en
pourcentage, mais pas du tout le même effort ressenti.

6,8 rend au téléphone son nombre de gestes d'avant l'allongement. Il se trouve
que c'est aussi la valeur qui rapproche le geste du défilement natif : un
balayage de 300 px y parcourt environ 785 px, soit à peu près une hauteur
d'écran, ce qu'un doigt attend.

**Vérifiez le rapport `GAIN_TACTILE / GAIN_MOLETTE` (1,36) sur un vrai téléphone**
si vous changez la longueur du parcours.

#### `IMPULSION_FLECHE = 0.125` et `IMPULSION_PAGE = 0.75`

En hauteurs d'écran. Une flèche avance d'environ un huitième d'écran, une page
d'environ trois quarts — les proportions du défilement natif. Elles passent par
`impulsion(d * GAIN_MOLETTE)`, donc la glisse s'y applique.

`Home` et `End` **sautent** au lieu de pousser, et remettent les deux vitesses à
zéro : c'est leur rôle.

#### `VITESSE_MAX = 8000` (px/s)

Plafond appliqué à l'accumulation, pas à la vitesse appliquée.

*Au doigt* : c'est le réglage **anti-traversée éclair**. Un coup de molette
violent ne doit pas pouvoir catapulter le visiteur à travers deux séquences. Il
peut aller vite, il ne peut pas fuser.

*Plus grand* : on traverse un chapitre sans l'avoir vu, et l'anneau d'images ne
suit pas — l'écran se met à sauter grossièrement.
*Plus petit* : le retour en arrière devient laborieux.

#### `ECRANS_PAR_SEQUENCE = 6.0`

Longueur de défilement **par défaut** d'un segment, en hauteurs d'écran. Chaque
séquence peut la redéfinir par son champ `ecrans`.

*Au doigt* : c'est le **rythme**. Ce genre de site est un objet qu'on regarde,
pas une page qu'on traverse. À 4, on arrivait au bout sans avoir eu le temps de
rien admirer.

Elle règle aussi un second problème sans rien coûter : le même clip étalé sur
50 % de distance en plus, c'est 50 % d'écart en moins entre deux images
consécutives à vitesse égale. **Le scrub y gagne en finesse par la même
opération.**

Deux garde-fous dans `impulsion()` qu'il ne faut pas retirer :

```js
if (position <= 0 && velocite < 0) velocite = 0;
if (position >= total && velocite > 0) velocite = 0;
```

Sans eux, le visiteur pousse dans le vide contre une extrémité, accumule de la
vitesse invisible, et la page repart en retard quand il change de sens.

---

## 4. L'anneau d'images et le préchargement

### 4.1 Le modèle mémoire, et son arithmétique

**Le poids transféré n'est pas la contrainte. La mémoire l'est.**

Une image décodée occupe `largeur × hauteur × 4` octets, **quel que soit son
format compressé** :

| Jeu | Décodée | 181 images | 40 images | 90 images |
|---|---|---|---|---|
| 1280 × 720 | 3,52 Mio | 637 Mio | 141 Mio | 317 Mio |
| 854 × 480 | 1,56 Mio | 283 Mio | 63 Mio | 141 Mio |

Retenir une séquence entière décodée fait plus de 600 Mio, et un onglet mobile
meurt bien avant. D'où l'architecture : **un anneau glissant de 40 images
décodées** autour de l'index courant, tout le reste restant sous forme d'octets
compressés.

Les deux responsabilités sont **séparées, et c'est ce qui rend le modèle
possible** :

- `frame-source.js` va chercher les octets et ne décode jamais. Il garde tout en
  mémoire compressée (une séquence WebP fait environ 8,75 Mo).
- `frame-ring.js` décode et **évince**. C'est lui qui coûte la mémoire.

`RING_SIZE = 40` n'est pas choisi au plafond mais au besoin : de quoi couvrir un
aller-retour rapide de la main sans jamais redécoder. Le banc a tenu 400 images
retenues sur iPad sans recyclage de l'onglet, soit dix fois cette valeur.

`RING_MAX = 90` est le plafond dur : au-delà, une séquence dense coûterait plus
que ce qu'un onglet mobile accepte. Quand le plafond mord, le tampon est
simplement plus court sur cette séquence.

### 4.2 La fenêtre se compte en PIXELS DE DÉFILEMENT, jamais en images

```js
export const TAMPON_DEVANT_PX = 420;
export const TAMPON_DERRIERE_PX = 180;
export const PART_FENETRE = 0.66;
```

C'est la correction d'un bug réel. Toutes les séquences occupent la même distance
de défilement, mais **pas le même nombre d'images** : 181 partout sur Parkside,
241 au toit, et 361 à la salle de vélos, qui reste à 24 images par seconde pour
que les manivelles ne soient pas crantées. Une fenêtre exprimée en nombre
d'images donnait donc aux vélos **la moitié du tampon des autres** — 180 px
d'avance contre 360 — et c'était précisément l'écran dont le texte pousse le
visiteur à défiler le plus vite possible.

Exprimée en distance, la fenêtre donne le même tampon partout, et les séquences
denses reçoivent simplement plus d'images.

`PART_FENETRE = 0.66` : la fenêtre ne peut occuper que deux tiers de l'anneau. Le
tiers restant est la marge qui garantit qu'une image demandée n'est jamais jetée
avant d'avoir servi.

### 4.3 `src/frames/prefetch.js`, intégralement

```js
// L'alimentation des segments voisins.
//
// Le brief demande de charger les images de la sequence suivante pendant que le
// visiteur est dans la courante. Creer son anneau ne suffit pas : un anneau
// alloue est vide, et le decodage ne commencerait qu'au franchissement de la
// frontiere -- l'ecran resterait alors fige sur la derniere image pendant que
// le defilement continue dans le vide.
//
// L'alimentation se fait donc a CHAQUE TRAME tant que le voisin n'est pas
// amorce, et non une seule fois a la frontiere : un franchissement rapide
// arrive avant la fin du decodage.
//
// Le sens compte. On entre dans le segment suivant par ses PREMIERES images et
// dans le precedent par ses DERNIERES : c'est ce qui rend le retour aussi
// fluide que l'aller, et le brief exige que le visiteur puisse revenir.

import {
  TAMPON_DEVANT_PX, TAMPON_DERRIERE_PX, PART_FENETRE,
  RING_SIZE, RING_MAX, DEGRADED_RING_SIZE,
} from '../config/constants.js';

/**
 * La fenetre et l'anneau d'UN segment, calcules sur sa densite d'images.
 *
 * Un segment de 361 images sur la meme distance qu'un segment de 181 avance
 * deux fois plus vite en images par pixel de defilement : a fenetre egale en
 * nombre d'images, son tampon en distance est deux fois plus court. On part
 * donc de la distance voulue et on en deduit le nombre d'images.
 *
 * @param {number} nbImages images du segment
 * @param {number} spanPx   distance de defilement du segment
 * @param {object} cfg      reglages du mode courant
 */
export function fenetrePour(nbImages, spanPx, cfg) {
  const pxParImage = spanPx / Math.max(nbImages - 1, 1);
  const devant = Math.max(4, Math.ceil(TAMPON_DEVANT_PX / pxParImage / cfg.pasImage));
  const derriere = Math.max(2, Math.ceil(TAMPON_DERRIERE_PX / pxParImage / cfg.pasImage));

  const plancher = cfg.degrade ? DEGRADED_RING_SIZE : RING_SIZE;
  const voulu = Math.ceil((devant + derriere + 1) / PART_FENETRE);
  const taille = Math.min(Math.max(voulu, plancher), RING_MAX);

  // Si le plafond mord, on retaille la fenetre pour qu'elle tienne dedans :
  // une fenetre plus large que son anneau le ferait s'evincer lui-meme, ce qui
  // est exactement le bug qu'on vient de corriger.
  const place = Math.floor(taille * PART_FENETRE) - 1;
  if (devant + derriere <= place) return { devant, derriere, taille };
  const k = place / (devant + derriere);
  return {
    devant: Math.max(4, Math.floor(devant * k)),
    derriere: Math.max(2, Math.floor(derriere * k)),
    taille,
  };
}

/**
 * Nombre d'images decodees qui suffit a couvrir un franchissement.
 *
 * Douze : `image()` cherche une voisine jusqu'a douze pas, donc au-dela de
 * douze images amorcees il y a toujours quelque chose a afficher a l'entree du
 * segment, meme si l'exacte n'est pas encore la. En dessous, une entree rapide
 * peut encore tomber dans le trou.
 */
export const AMORCE_VOISIN = 12;

/**
 * Decodages lances par voisin et par trame.
 *
 * Deux : assez pour amorcer douze images en six trames, soit un dixieme de
 * seconde, bien avant qu'un defilement meme rapide ne franchisse la frontiere.
 * Davantage ferait contendre les decodages du segment courant, qui est celui
 * qu'on regarde.
 */
export const PAQUET_PAR_TRAME = 2;

/**
 * Alimente les voisins du segment courant.
 *
 * @param {number[]} voisinage indices a garder charges, courant compris
 * @param {number}   courant   indice du segment affiche
 * @param {Function} anneauPour (i) => anneau
 * @param {Function} nbImages   (i) => nombre d'images du segment
 * @returns {number[]} les indices encore non amorces, pour le temoin
 */
export function alimenterVoisins(voisinage, courant, anneauPour, nbImages) {
  const enRetard = [];
  for (const i of voisinage) {
    if (i === courant) continue;
    const anneau = anneauPour(i);
    // Le suivant s'aborde par son debut, le precedent par sa fin.
    const versLAvant = i > courant;
    const depuis = versLAvant ? 1 : nbImages(i);
    const sens = versLAvant ? +1 : -1;
    if (!anneau.amorcer(depuis, sens, AMORCE_VOISIN, PAQUET_PAR_TRAME)) {
      enRetard.push(i);
    }
  }
  return enRetard;
}
```

### 4.4 L'alimentation des voisins, dans les deux sens

C'est le point le plus facile à rater.

**Un anneau alloué est un anneau VIDE.** Créer l'anneau du segment suivant ne
charge rien : le décodage ne commencerait qu'au franchissement de la frontière,
`image()` ne trouverait aucune voisine, rendrait `null`, et le rendu garderait la
dernière image peinte. **L'écran se fige alors que le défilement continue.**

Donc : l'alimentation se fait **à chaque trame** tant que le voisin n'est pas
amorcé, et non une seule fois à la frontière — un franchissement rapide arrive
avant la fin du décodage.

**Le sens compte.** On entre dans le segment suivant par ses PREMIÈRES images et
dans le précédent par ses DERNIÈRES :

```js
const versLAvant = i > courant;
const depuis = versLAvant ? 1 : nbImages(i);
const sens = versLAvant ? +1 : -1;
```

C'est ce qui rend le retour aussi fluide que l'aller. Le voisin d'avant reste
chargé parce que le visiteur doit pouvoir revenir sans payer un second premier
passage.

`AMORCE_VOISIN = 12` et `PAQUET_PAR_TRAME = 2` : douze images amorcées à raison
de deux par trame, soit six trames, un dixième de seconde — bien avant qu'un
défilement même rapide ne franchisse la frontière. Davantage ferait contendre les
décodages du segment courant, qui est celui qu'on regarde.

### 4.5 `src/frames/frame-ring.js`, intégralement

```js
// L'anneau glissant d'images decodees.
//
// C'est la piece qui decide de la tenue du projet. Une image 1280x720 decodee
// occupe 3,5 Mio : retenir les 181 images d'une sequence en ferait 637, et un
// onglet mobile meurt bien avant. On n'en garde donc qu'une fenetre autour de
// l'index courant, et tout le reste reste sous forme d'octets compresses.
//
// Le decodage passe par createImageBitmap, qui travaille hors du fil principal :
// la promesse revient sur le fil principal mais le decodage lui-meme ne le
// bloque pas. C'est ce qui permet de decoder en avance pendant que le visiteur
// fait defiler sans provoquer de saccade.

export function creerAnneau(source, { taille, pasImage: pasInitial = 1, nbImages }) {
  let tailleCourante = taille;
  let pasImage = pasInitial;
  const decodees = new Map();   // index -> ImageBitmap
  const enCours = new Set();    // index en cours de decodage
  let centre = 1;               // index courant, reference de l'eviction
  let ecartDernier = 0;         // distance entre l'image voulue et celle rendue

  /** Ramene un index quelconque sur la grille du mode courant. */
  const surGrille = (i) => {
    const j = Math.round(i / pasImage) * pasImage;
    return Math.min(Math.max(j, 1), nbImages);
  };

  async function assurer(i) {
    i = surGrille(i);
    if (decodees.has(i) || enCours.has(i)) return;
    enCours.add(i);
    try {
      const buf = await source.charger(i);
      // Reverification : entre le fetch et ici, l'image a pu etre decodee par
      // un autre appel, ou evincee puis redemandee.
      if (decodees.has(i)) return;
      const bmp = await createImageBitmap(new Blob([buf]));
      decodees.set(i, bmp);
      evincer(i);
    } catch (e) {
      // Une image manquante ne doit jamais casser la page : on garde l'image
      // precedente a l'ecran. Le brief interdit l'ecran vide.
      console.warn(e.message);
    } finally {
      enCours.delete(i);
    }
  }

  /**
   * Eviction par DISTANCE a l'index courant, jamais par ordre d'insertion.
   *
   * Le premier entre, premier sorti n'est correct que sur un parcours
   * strictement monotone. Au premier aller-retour il evince les images les plus
   * anciennement inserees -- c'est-a-dire le centre et ses voisines immediates,
   * exactement celles qu'on affiche. L'anneau se detruisait alors lui-meme a
   * chaque trame, et c'est ce qui produisait le gel.
   *
   * On jette donc toujours la plus eloignee du centre, en protegeant l'image
   * qu'on vient d'ajouter.
   */
  function evincer(proteger) {
    while (decodees.size > tailleCourante) {
      let pire = null, pireD = -1;
      for (const k of decodees.keys()) {
        if (k === proteger) continue;
        const d = Math.abs(k - centre);
        if (d > pireD) { pireD = d; pire = k; }
      }
      if (pire === null) break;
      decodees.get(pire)?.close();
      decodees.delete(pire);
    }
  }

  /**
   * Prend l'image la plus proche disponible, A N'IMPORTE QUELLE DISTANCE.
   *
   * C'est la correction du gel. La recherche etait bornee a douze pas : au-dela
   * elle rendait null, le rendu gardait la derniere image peinte, et l'ecran se
   * figeait pendant que le defilement continuait. Revenir en arriere ramenait a
   * moins de douze images d'une image decodee, ce qui « debloquait » -- le
   * symptome exact.
   *
   * Or le deficit est structurel et aucun tampon ne le comble : trois crans de
   * molette demandent 75 a 150 images par seconde, un decodage WebP en produit
   * 30 a 60. La page ne peut donc pas suivre un defilement rapide, et ce n'est
   * pas ce qu'on lui demande -- on lui demande de DEGRADER au lieu de geler.
   *
   * En rendant toujours la plus proche disponible, un defilement rapide montre
   * un echantillonnage plus grossier de la sequence : le mouvement reste
   * continu, il perd seulement en finesse. Le visiteur ralentit, la finesse
   * revient. C'est le comportement d'une video qui saute des images, pas celui
   * d'une page cassee.
   */
  function image(i) {
    const exact = surGrille(i);
    const trouve = decodees.get(exact);
    if (trouve) { ecartDernier = 0; return trouve; }
    let meilleur = null, meilleureD = Infinity;
    for (const k of decodees.keys()) {
      const d = Math.abs(k - exact);
      if (d < meilleureD) { meilleureD = d; meilleur = k; }
    }
    if (meilleur === null) return null;
    ecartDernier = meilleureD;
    return decodees.get(meilleur);
  }

  /**
   * Demande le decodage autour de l'index courant, DU PLUS PROCHE AU PLUS
   * LOIN, et par paquets bornes.
   *
   * L'ordre et la borne comptent autant que la fenetre. La version precedente
   * lancait jusqu'a trente-sept requetes par trame, soit plus de deux mille par
   * seconde : un navigateur n'ouvre que six connexions par origine, et l'image
   * dont on a besoin MAINTENANT se retrouvait derriere des centaines de
   * requetes emises pour des positions deja depassees. La file ne se vidait
   * jamais.
   *
   * En partant du centre et en bornant le paquet, ce qu'on affiche est toujours
   * demande en premier, et la file reste courte.
   */
  function pourvoir(i, sens, { devant, derriere, paquet = 4 }) {
    centre = surGrille(i);
    const avant = sens >= 0 ? devant : derriere;
    const arriere = sens >= 0 ? derriere : devant;

    let lances = 0;
    const demander = (idx) => {
      if (lances >= paquet) return;
      const j = surGrille(idx);
      if (decodees.has(j) || enCours.has(j)) return;
      assurer(j);
      lances++;
    };

    demander(centre);
    const portee = Math.max(avant, arriere);
    for (let k = 1; k <= portee && lances < paquet; k++) {
      if (k <= avant) demander(centre + k * pasImage);
      if (k <= arriere) demander(centre - k * pasImage);
    }
  }

  /**
   * Amorce l'anneau dans UN seul sens, par paquets bornes.
   *
   * Sert aux segments voisins, qui doivent etre prets avant qu'on y entre. Un
   * anneau alloue est un anneau VIDE : sans amorcage, le decodage ne commence
   * qu'au franchissement de la frontiere, `image()` ne trouve aucune voisine a
   * moins de douze pas, rend null, et le rendu garde la derniere image
   * affichee. L'ecran se fige alors que le defilement continue.
   *
   * Le paquet est borne parce qu'on appelle cette methode a chaque trame :
   * lancer quarante decodages d'un coup a la frontiere ferait exactement
   * l'a-coup qu'on cherche a eviter.
   *
   * @param {number} depuis image de depart
   * @param {number} sens   +1 vers la fin, -1 vers le debut
   * @param {number} cible  nombre d'images decodees visees
   * @param {number} paquet nombre de decodages lances par appel
   */
  function amorcer(depuis, sens, cible, paquet = 3) {
    if (decodees.size >= cible) return true;
    // L'anneau d'un voisin n'a pas encore de centre : son point d'entree en
    // tient lieu, sinon l'eviction jetterait justement ce qu'on amorce.
    centre = surGrille(depuis);
    let lances = 0;
    for (let k = 0; k < cible && lances < paquet; k++) {
      const i = surGrille(depuis + sens * k * pasImage);
      if (decodees.has(i) || enCours.has(i)) continue;
      assurer(i);
      lances++;
    }
    return decodees.size >= cible;
  }

  return {
    assurer,
    pourvoir,
    amorcer,
    image,
    /**
     * Change la taille et le pas SANS jeter le contenu decode.
     *
     * Appele quand le mode degrade bascule en cours de visite. Detruire les
     * anneaux a cet instant -- ce que faisait le code -- vidait celui qu'on
     * etait en train d'afficher : l'image se figeait net et ne revenait
     * jamais. C'etait la vraie cause du blocage a partir de la salle de velos,
     * ou la charge de decodage double et fait justement basculer le mode.
     *
     * L'eviction fait le reste toute seule, au fil des trames.
     */
    reconfigurer({ taille: t, pasImage: p }) {
      if (t) tailleCourante = t;
      if (p) pasImage = p;
      evincer(centre);
    },
    get pretes() { return decodees.size; },
    /** Distance, en images, entre l'image voulue et celle reellement rendue. */
    get ecartDernier() { return ecartDernier; },
    get octetsCharges() { return source.octetsCharges; },
    detruire() {
      decodees.forEach((b) => b.close());
      decodees.clear(); enCours.clear();
    },
  };
}
```

### 4.6 Les trois règles de l'anneau

Elles sont chacune la correction d'un gel observé. Ne les changez pas.

**1. Éviction par DISTANCE au centre, jamais par ordre d'insertion.** Le premier
entré, premier sorti n'est correct que sur un parcours strictement monotone. Au
premier aller-retour, il évince les images les plus anciennement insérées —
c'est-à-dire le centre et ses voisines immédiates, exactement celles qu'on
affiche. L'anneau se détruit alors lui-même à chaque trame.

**2. `image()` cherche la plus proche disponible, à n'importe quelle distance.**
La recherche était bornée à douze pas : au-delà elle rendait `null`, le rendu
gardait la dernière image, et l'écran se figeait. Le déficit est **structurel** et
aucun tampon ne le comble : trois crans de molette demandent 75 à 150 images par
seconde, un décodage WebP en produit 30 à 60. On ne demande pas à la page de
suivre, on lui demande de **dégrader** — un défilement rapide montre un
échantillonnage plus grossier, le mouvement reste continu et perd seulement en
finesse. C'est le comportement d'une vidéo qui saute des images, pas d'une page
cassée.

**3. `pourvoir()` demande du plus proche au plus loin, par paquets bornés.**
L'ordre et la borne comptent autant que la fenêtre. Une version lançait jusqu'à
37 requêtes par trame, soit plus de 2 000 par seconde : un navigateur n'ouvre que
six connexions par origine, et l'image dont on a besoin *maintenant* se
retrouvait derrière des centaines de requêtes émises pour des positions déjà
dépassées. La file ne se vidait jamais.

Une quatrième, pour le mode dégradé : `reconfigurer()` change la taille et le pas
**sans jeter le contenu décodé**. Détruire les anneaux au moment où le mode
bascule vide celui qu'on est en train d'afficher — l'image se fige net et ne
revient jamais.

---

## 5. La carte des séquences et les raccords

### 5.1 Comment un segment reçoit sa longueur

`src/scroll/sequence-map.js` :

```js
const SEGMENTS = [...SEQUENCES, FAITS];

function remesurer() {
  let debut = 0;
  bornes = SEGMENTS.map((seq) => {
    const longueur = (seq.ecrans ?? ECRANS_PAR_SEQUENCE) * window.innerHeight;
    const b = { seq, debut, longueur };
    debut += longueur;
    return b;
  });
  hauteur = debut;
  return debut;
}
```

**Régler le rythme d'un chapitre = poser `ecrans` sur sa séquence.** Rien
d'autre. Les valeurs de Parkside, pour donner l'échelle (défaut 6) :

| Segment | `ecrans` | Pourquoi |
|---|---|---|
| `02-seuil` | 5 | un passage, pas un lieu |
| `04-spa` | 7 | le creux de la page : il n'existe que s'il dure |
| `05-velos` | 8 | |
| `06a-salle-sport` | 9 | |
| `06b-mur-yoga` | 7 | le point le plus bas de la page, il lui faut du temps |
| `10-toit` | 12 | le seul écran construit pour retenir quelqu'un |

L'écran final (les faits sur noir) est un segment comme les autres, avec
`sansImage: true` : le défilement par cran d'écran entier est interdit, donc il ne
peut pas apparaître d'un coup. `voisinage()` est borné à `SEQUENCES` et non à
`SEGMENTS` — un segment sans images n'a jamais d'anneau.

### 5.2 La mise en route

```js
function imageA(seq, t) {
  const [deb, fin] = bornesDe(seq);
  const mer = seq.miseEnRoute ?? MISE_EN_ROUTE_DEFAUT;   // defaut 0
  let u = t;
  if (mer > 0 && t < mer) u = (t * t) / mer;
  return deb + u * (fin - deb);
}
```

Sur cette part du segment, la progression suit un carré au lieu d'une droite : la
caméra part lentement et prend sa vitesse. À poser **uniquement sur les segments
qui démarrent à l'arrêt**. Le défaut est nul parce que la plupart enchaînent un
mouvement déjà lancé. Parkside : `02-seuil` à 0,12 et `06a-salle-sport` à 0,16.

### 5.3 Les raccords : deux dispositifs, et lequel est vraiment lu

**Attention, piège de lecture.** La configuration de Parkside contient des
champs `fondanteEntree: false` et `fondanteSortie: false`. **Ils ne sont lus par
aucun code.** Vérifié :

```
$ grep -rn "fondanteEntree\|fondanteSortie" src/ --include=*.js
src/config/sequences.js:  (10 declarations)
src/frames/transitions.js:  (2 lignes de commentaire)
```

Ce sont des vestiges d'une première version, conservés comme documentation des
raccords directs. **Ne les reprenez pas** : ils donneraient l'illusion de régler
quelque chose. Les deux mécanismes réellement actifs sont les suivants.

#### Le fondu ENCHAÎNÉ — `fonduEnchaine`

C'est le raccord ordinaire. Sur la première part du segment, la dernière image du
clip précédent reste dessous et le nouveau monte par-dessus en opacité.

```js
const partFondu = seq.fonduEnchaine ?? PART_FONDU_ENCHAINE;   // defaut 0.05
const enFondu = index > 0 && seq.estLeSeuil !== true
  && !SEQUENCES[index - 1].estLeSeuil && t < partFondu;
```

`PART_FONDU_ENCHAINE = 0.05` : sur un segment de six hauteurs d'écran à 900 px,
cela fait 270 px, soit environ une seconde et demie à l'allure de visite. Assez
pour que l'œil ne voie pas de coupe, assez court pour ne pas ramollir le montage.

**Un raccord direct se fait en posant `fonduEnchaine: 0`.** Rien d'autre.

Pourquoi un fondu enchaîné et non une baisse de luminosité : **une baisse
assombrit sans cacher la coupe**. On voit l'image changer à mi-noir, ce qui se
remarque *plus* qu'une coupe franche.

Et pourquoi pas simplement mieux choisir l'image de raccord : parce que la mesure
dit que ça ne marche pas. Une recherche exhaustive 32 × 40 sur la jonction la
plus difficile de Parkside n'a gagné que **1 %** d'écart. Les deux clips diffèrent
réellement — parallaxe, position de caméra — et aucun choix d'image ne le
supprime. Seul un fondu le noie.

#### L'extinction et le rallumage — `extinctionSortie` / `allumageEntree`

Réservés aux **événements**, pas aux raccords. `src/frames/transitions.js` :

```js
export function luminositePour(seq, t, { premiere = false, derniere = false } = {}) {
  const all = seq.allumageEntree;
  if (all && !premiere && t < all.part) {
    return all.plancher + (1 - all.plancher) * (t / all.part);
  }
  const ext = seq.extinctionSortie;
  if (!ext || derniere) return 1;
  const debutTenue = 1 - (ext.tenue ?? 0);
  if (t >= debutTenue) return ext.plancher;
  const debutDescente = debutTenue - ext.part;
  if (t > debutDescente) {
    return 1 + (ext.plancher - 1) * ((t - debutDescente) / ext.part);
  }
  return 1;
}
```

Appliqué par **multiplication** — `filter: brightness(v)` — donc les ombres
meurent en premier et les bords éclairés en dernier. Aucun voile clair, aucun
mode de fusion, aucun shader : une propriété CSS composée par le GPU.

**La règle des deux côtés.** Une extinction sur un segment doit être suivie d'un
`allumageEntree` sur le suivant, et ce suivant doit avoir `fonduEnchaine: 0` —
sinon on rallume tout en fondant, et l'on voit les deux. Les deux paires de
Parkside :

```js
// 02-seuil
estLeSeuil: true,
extinctionSortie: { part: 0.28, plancher: 0, tenue: 0.12 },
// 03-comptoir
allumageEntree: { part: 0.10, plancher: 0 },
fonduEnchaine: 0,

// 04-spa
extinctionSortie: { part: 0.22, plancher: 0, tenue: 0.06 },
// 05-velos
allumageEntree: { part: 0.14, plancher: 0 },
fonduEnchaine: 0,
```

`tenue` est ce qui fait la différence entre une transition et un événement : sans
elle, l'extinction atteint le noir exactement à la dernière image et l'on n'y
reste pas. Avec `part: 0.28, tenue: 0.12`, la descente prend 28 % du segment puis
12 % sont tenus au noir — environ deux secondes et demie à l'allure nominale.

### 5.4 Ce qu'on voit à l'écran quand on se trompe

| Erreur | Symptôme |
|---|---|
| `fonduEnchaine` laissé au défaut sur un raccord direct | un flou d'une seconde et demie au milieu d'un mouvement continu de caméra ; on croit à une baisse de cadence |
| `fonduEnchaine: 0` sur un raccord non contigu | coupe franche visible, l'image saute |
| `extinctionSortie` sans `allumageEntree` sur le suivant | le segment suivant démarre en plein noir et le reste ; on croit à une image manquante |
| `allumageEntree` sans `fonduEnchaine: 0` | l'image précédente réapparaît en fondu par-dessus le noir qui remonte, deux mouvements contradictoires |
| `extinctionSortie` sans `tenue` | le noir est atteint et quitté dans la même trame ; l'événement passe inaperçu |
| `miseEnRoute` oublié sur un segment qui démarre à l'arrêt | la caméra part d'un coup à pleine vitesse au franchissement |

---

## 6. La couche sonore

### 6.1 La doctrine

Le son n'est pas un habillage sur ce genre de site, **c'est l'argument
principal**. La moitié de ce qu'on démontre — l'isolation acoustique, le calme
d'un appartement, le parc en face — n'est démontrable que par le son.

Quatre règles, dans l'ordre d'importance.

**1. Le défilement ne pilote JAMAIS une tête de lecture.** Toutes les nappes
tournent en boucle en permanence, chacune à sa vitesse réelle, du premier au
dernier écran. Le défilement ne pilote que des **gains et des filtres**.

C'est l'erreur à ne jamais commettre. Piloter un fichier audio par la position du
scroll accélérerait littéralement le monde quand le visiteur scrolle vite : un bus
passerait en une demi-seconde et des pas deviendraient une mitraillette.

**2. Les niveaux sont des cibles, pas des valeurs.** On écrit `setTargetAtTime`,
jamais `gain.value =`. Le lissage tue l'effet mécanique : sans lui, chaque cran
de molette produit un micro-saut de niveau, et ça sonne comme une machine.

**3. Tout en décibels, jamais en linéaire.** `-60` vaut silence. Une seule
exception dans tout le site, documentée : le gain de l'eau du bassin, qui suit
une vitesse de pointeur et non un niveau de mélange.

**4. Les pièces se scellent, elles ne se coupent pas.** Voir §6.4.

Deux interdits de forme : **aucun son ne démarre sans clic explicite** (le
contexte est créé suspendu), et **Web Audio natif, aucune bibliothèque**.

### 6.2 Le graphe

```
sources (BufferSource, loop) -> gain par nappe -> [scellement] -> bus maitre -> destination
```

`src/audio/graph.js` crée le contexte à la demande, avec un `maitre` à gain 0.
`ouvrir(duree)` le remonte à 1 par `setTargetAtTime`. `fermer()` **coupe le son
sans arrêter les pistes** : elles continuent à leur horloge, ce qui est
indispensable — les redémarrer les remettrait en phase et l'on entendrait leur
simultanéité.

Une exception importante : l'amorce (le son du logo) **ne passe pas par le bus
maître**. Si elle y passait, la bascule silence la couperait au milieu, alors
qu'elle est le seul son de la page dont on ne peut pas sortir à moitié.

### 6.3 Comment la position pilote les gains

`src/audio/scene.js`. Chaque séquence déclare des `couches`, une par piste :

```js
couches: {
  'ville-lointaine': { debut: -12, fin: -30 },
  'parc-jour':       { debut: -24, fin: -60, bosse: 0.40, dbBosse: -13 },
  'parc-nuit':       { debut: -60, fin: -17, retard: 0.42 },
  'vent':            { debut: -16, fin: -16 },
}
```

La courbe est calculée ainsi :

```js
function niveau(c, t) {
  if (typeof c === 'number') return c;
  const { debut, fin, bosse, dbBosse, retard = 0 } = c;
  if (retard > 0 && t < retard) return -60;
  const u = retard > 0 ? (t - retard) / (1 - retard) : t;
  if (bosse !== undefined) {
    return u <= bosse
      ? debut + (dbBosse - debut) * (u / bosse)
      : dbBosse + (fin - dbBosse) * ((u - bosse) / (1 - bosse));
  }
  return debut + (fin - debut) * u;
}
```

`debut`/`fin` suffisent à la plupart. `bosse` : la couche fait un maximum à cette
progression puis se retire — c'est ce qui rend vrai qu'en plein jour la ville a
gagné et que les oiseaux sont toujours là dessous. `retard` : la couche n'entre
qu'à partir de cette progression.

L'application, une seule ligne :

```js
for (const n of noms) banque.viser(n, niveau(seq.couches[n], t), TAU_GAIN);
```

`TAU_GAIN = 1.5` seconde. Si le visiteur descend d'un coup sec, l'image saute
mais la ville met deux secondes à arriver. Elle ne peut pas être brusquée.

**La banque est obligatoire.** Une piste qui sert dans plusieurs scènes ne doit
JAMAIS être dupliquée : un seul enregistrement joué à des niveaux différents,
c'est ce qui fait entendre un lieu plutôt qu'une collection de scènes.

Le bouclage, enfin :

```js
src.loopStart = ROGNAGE_BOUCLE;                                    // 0.05
src.loopEnd = Math.max(ROGNAGE_BOUCLE * 2, tampon.duration - ROGNAGE_BOUCLE);
src.start(0, Math.random() * tampon.duration);
```

On ne s'appuie **jamais** sur les bornes du tampon décodé : le délai d'encodeur
MP3 est traité différemment selon les navigateurs et boucler sur la borne produit
un clic. Et le départ à une position quelconque évite que deux nappes démarrées
ensemble fassent entendre leur simultanéité.

### 6.4 Le scellement d'une pièce

C'est le mécanisme qui vend le vitrage, donc littéralement l'argument commercial.
Il tient entièrement dans le **décalage entre deux paramètres** :

```js
export const SCELLEMENT_FILTRE_OUVERT = 18000;   // Hz
export const SCELLEMENT_FILTRE_FERME  = 200;     // Hz
export const SCELLEMENT_T_FILTRE      = 0.2;     // s
export const SCELLEMENT_T_VOLUME      = 0.65;    // s
```

Le passe-bas se referme en 0,2 s, de 18 kHz à 200 Hz. Le volume met 0,65 s à
rejoindre le niveau intérieur. **Pendant ce décalage il ne reste qu'une masse
grave sans aucun détail, encore forte, qui s'efface ensuite.** C'est ça, la
sensation d'une vitre qui se referme. Si les deux descendaient ensemble, on
entendrait une coupure.

Deux détails qui comptent :

```js
filtre.Q.value = 0.7;
```

Pente douce, sans bosse à la coupure. Une résonance ici s'entendrait comme un
filtre, or on veut entendre une vitre.

```js
const f = FILTRE_OUVERT * Math.pow(FILTRE_FERME / FILTRE_OUVERT, part);
```

Le filtre se déplace en fréquence de façon **exponentielle** : l'oreille entend
les hauteurs en rapport, pas en différence. Une rampe linéaire de 18 kHz à 200 Hz
passerait tout son temps dans les aigus inaudibles puis plongerait d'un coup.

Déclaration côté séquence :

```js
scellement: { pistes: ['ville-proche', 'ville-lointaine'], part: 0.4,
              dbOuvert: -10, dbFerme: -30 },
```

Les durées sont surchargeables **par appel**, parce qu'une traversée de vitre n'a
pas les mêmes à l'aller et au retour : à l'aller tout arrive ensemble en 0,3 s
(`TRAVERSEE_T_ALLER`) — on ne franchit pas une vitre progressivement, et c'est le
seul mouvement brusque autorisé de tout le site ; au retour le filtre court
devant et le volume traîne derrière.

### 6.5 Le contrat d'interface : les fichiers audio attendus

Le moteur ne connaît que des **noms**. La table `PISTES` de `src/config/audio.js`
fait la correspondance vers `/audio/`. Toute piste référencée par une couche, un
déclencheur ou un comportement doit y figurer, sinon `banque.obtenir` lève
`piste inconnue`.

Les seize de Parkside, **à remplacer** — la colonne « rôle » est ce qui se
transpose, pas les noms. **Si le bâtiment n'est pas en ville, lisez la §6.8
avant de composer cette table** : trois de ces pistes n'y survivent pas telles
quelles.

| Nom | Rôle générique | Boucle |
|---|---|---|
| `parc-nuit` | ambiance extérieure nocturne, insectes | oui |
| `parc-jour` | ambiance extérieure diurne, oiseaux | oui |
| `ville-lointaine` | rumeur urbaine à distance | oui |
| `ville-proche` | circulation au pied du bâtiment | oui |
| `ville-interieure` | la même ville, entendue à travers un vitrage | oui |
| `vent` | nappe stable en hauteur | oui |
| `eau` | l'eau du bassin, pilotée à la main | oui |
| `piece-sport`, `piece-bar` | ambiance humaine d'une salle | oui |
| `spa-bourdon`, `spa-remous` | les deux couches d'un lieu humide | oui |
| `musique-velos`, `musique-bar` | musique diégétique d'une salle | oui |
| `rideau` | un mécanisme qui glisse | oui |
| `air-seuil` | masse d'air d'un franchissement | non, `unique: true` |
| `hall-cles-pas` | événement ponctuel d'un lieu | non, `unique: true` |
| `logo.mp3` | l'amorce ; **pas dans `PISTES`**, chargé par `graph.js` | non |

Contraintes de production :

- **MP3**, débit variable par piste selon la bande réellement occupée, mesurée
  par analyse spectrale et non estimée. Parkside : 64 k pour les nappes graves
  mono, 80–96 k pour ce qui reste sous 1,4 kHz, 128 k pour ce qui a du contenu
  aigu réel, 192 k pour les musiques. Gain mesuré : **44,86 → 28,51 Mo, −36 %.**
- Une piste **filtrée en temps réel** doit être encodée plus haut que les autres :
  un filtre révèle les défauts d'encodage au lieu de les masquer.
- Durée de boucle : 60 à 90 s de préférence. Parkside a une exception à 45 s
  (`vent`), validée parce que c'est un bruit continu sans événement identifiable.
  **Son point de bouclage est le seul à vérifier à l'oreille.**

Les sons **uniques** passent par `one-shots.js` et portent un verrou : ils ne
rejouent pas si le visiteur remonte puis redescend. Sans verrou, un aller-retour
au seuil de déclenchement produit une mitraillette. Ils ont aussi un
`effacer(tau)` : si l'on quitte la scène avant la fin de la traîne, elle
s'éteint — sinon des pas continuent dans la scène suivante.

### 6.6 L'amorce, et le piège de son minutage

Le son du logo doit tomber **exactement** sur la première image d'apparition du
logo. Deux conditions, et la seconde est contre-intuitive.

**1. L'amorce part en tête, et sans être attendue.**

```js
jouerAmorce({ retard: INTRO_LOGO_ENTREE })
  .catch((e) => console.warn('amorce muette : ' + e.message));
if (!vumetre) vumetre = creerVumetre(barres);
await activerSon(OUVERTURE_SON);
```

`activerSon` charge et décode les nappes de toutes les scènes : plusieurs
secondes au premier passage. Appelée après, l'amorce arrivait longtemps après le
logo qu'elle accompagne. Elle n'est pas attendue non plus — une amorce muette ne
doit pas empêcher le reste du son de s'ouvrir.

**2. Elle se programme sur l'horloge AUDIO, pas sur celle du JavaScript.**

```js
export async function jouerAmorce({ retard = 0, db = -3 } = {}) {
  const c = contexte();
  if (c.state === 'suspended') await c.resume();   // AVANT tout le reste
  const vise = c.currentTime + retard;
  const buf = await c.decodeAudioData(await prechargerAmorce());
  ...
  src.start(Math.max(vise, c.currentTime));
}
```

Le contexte est repris **avant** de lire `currentTime` : il n'avance pas tant
qu'il est suspendu, et l'instant visé serait calculé sur une horloge arrêtée. Le
tampon se décode pendant le délai, et le décodage ne dure pas le même temps à
chaque visite — c'est la seule façon de tomber juste.

`prechargerAmorce()` va chercher les octets **au chargement de la page**, sans
toucher au contexte audio : un `fetch` ne fait aucun bruit, donc la règle « aucun
son sans clic » tient.

### 6.7 La traversée de vitre

**Sur Parkside c'était du contenu : une séquence, une fois. Si votre site fait
sortir la caméra du bâtiment plusieurs fois, ce comportement devient de la
machine.** Écrivez-le une fois, déclarez-le sur chaque segment concerné.

#### La doctrine, en une phrase

**Franchir une vitre est un événement à UNE IMAGE, jamais une courbe sur le
segment.**

C'est le point que tout le monde rate. La tentation est d'écrire une couche
`{ debut: -60, fin: -10 }` sur les pistes extérieures et de laisser le
défilement les faire monter. Le résultat est faux : les oiseaux et la ville
montent **pendant qu'on est encore derrière le verre**. On les entend à travers
une fenêtre fermée, et toute la démonstration d'isolation s'effondre à l'endroit
précis où elle devait culminer.

Donc : **trois états discrets**, et une bascule à l'image.

```
AVANT    image < sortie      dedans, couches exterieures PLATES et basses, scelle
DEHORS   sortie <= image < retour   dehors, tout a plein niveau, ouvert
APRES    image >= retour     dedans a nouveau, refermé
```

#### L'asymétrie, qui est tout l'effet

Ce ne sont pas les valeurs qui produisent la sensation, c'est **l'écart entre
deux paramètres**, et cet écart n'est pas le même dans les deux sens.

**L'aller** — filtre et volume arrivent **ensemble**, en `TRAVERSEE_T_ALLER = 0.3` s.
On ne franchit pas une vitre progressivement : une fois le verre passé, il n'y a
physiquement plus rien entre l'intérieur et l'extérieur. **C'est le seul
mouvement brusque autorisé de tout le site**, et il est justifié par la physique.

**Le retour** — le passe-bas se referme en `SCELLEMENT_T_FILTRE = 0.2` s, de
18 kHz à 200 Hz : les aigus disparaissent presque instantanément. Le volume, lui,
met `SCELLEMENT_T_VOLUME = 0.65` s à rejoindre le niveau intérieur.

Pendant ce décalage il ne reste qu'une **masse grave sans aucun détail, encore
forte**, qui s'efface ensuite. C'est ça, la sensation d'une vitre qui se referme.
Si les deux descendaient ensemble on entendrait une coupure — et une coupure
sonne comme un montage, jamais comme une fenêtre.

#### La déclaration

```js
traversee: {
  sortie: IMAGE_SORTIE_VITRE,      // 68 sur Parkside
  retour: IMAGE_RENTREE_VITRE,     // 141
  // Ce qu'on entend UNE FOIS DEHORS, a plein niveau.
  dehors: { 'ville-lointaine': -10, 'parc-jour': -12, 'vent': -18 },
  // Le niveau de ces memes pistes tant qu'on est DERRIERE la vitre. Plates.
  dbDehorsAvant: -60,
  dbDedans: -46,
  // Ce qui reste une fois la piece refermee.
  dbVilleInterieure: -36,
},
```

**Les deux seuils sont des constantes nommées, jamais des nombres dans le code.**
Ce sont des valeurs que le client voudra régler, et il les réglera à l'image
près, en regardant. Sur Parkside, la bonne image a été trouvée en **regardant une
capture d'écran**, pas en la calculant depuis le minutage — le calcul donnait 42,
l'œil donnait 68.

#### Trois pièges, tous rencontrés

**1. `ville-interieure` n'est PAS une couche de la séquence.** Elle appartient au
comportement. Le mélangeur générique tourne **avant** les comportements et la
remettrait à son niveau à chaque trame : impossible alors de la couper pendant
qu'on est dehors, ni de la faire revenir au retour. C'est un piège d'ordre
d'exécution, et il est silencieux — tout a l'air branché, rien ne marche.

**2. Le retour doit restaurer l'intérieur, pas seulement fermer.** Sans faire
revenir la piste intérieure au seuil de l'audible, la demi-seconde de fermeture
ne mène nulle part : **on referme sur du vide au lieu de refermer sur une
pièce**. Cette piste est ce qui dit qu'il y a encore un monde dehors.

**3. Tout ce qui est dehors n'est pas audible depuis un étage.** Sur Parkside,
depuis le sixième, la traversée révèle la ville lointaine, le parc et le vent —
**jamais la ville proche**. On n'entend pas une rue en détail à cette hauteur :
ni pas, ni portières, ni voix, seulement une masse diffuse et essentiellement
grave. Choisissez le contenu de `dehors` selon la **hauteur** de la scène.

#### Le module, intégralement

Il tient en 107 lignes et ne dépend que de `seal.js` et de la banque.

```js
// La traversee de vitre — sequence huit.
//
// Le passage le plus technique de la page, et tout s'y joue sur le DECALAGE
// entre deux parametres. Ce ne sont pas les valeurs qui font l'effet, c'est
// l'ecart entre elles.
//
//   L'ALLER, au franchissement de la vitre :
//     les trois pistes exterieures arrivent ENSEMBLE, filtre et volume en meme
//     temps, en trois dixiemes de seconde. On ne traverse pas une vitre
//     progressivement -- une fois le verre franchi il n'y a physiquement plus
//     rien entre l'interieur et l'exterieur. C'est le seul mouvement brusque
//     autorise de toute la page.
//
//   LE RETOUR, en rentrant dans la chambre :
//     le passe-bas se referme en deux dixiemes, de 18 kHz a 200 Hz : les aigus
//     disparaissent presque instantanement.
//     Le volume, lui, met six a sept dixiemes a rejoindre le niveau interieur.
//
// Pendant ce decalage il ne reste qu'une masse grave sans aucun detail, encore
// forte, qui s'efface ensuite. C'est ca, la sensation d'une vitre qui se
// referme. Si les deux parametres descendaient ensemble on entendrait une
// coupure -- et une coupure sonne comme un montage, jamais comme une fenetre.
//
// Dehors : ville lointaine, parc jour, vent. JAMAIS la ville proche : depuis le
// sixieme etage on n'entend pas une rue en detail, ni pas, ni portieres, ni
// voix, seulement une masse diffuse et essentiellement grave.

import { bus } from '../graph.js';
import { creerScellement } from '../seal.js';
import {
  TRAVERSEE_T_ALLER,
  SCELLEMENT_T_FILTRE, SCELLEMENT_T_VOLUME,
} from '../../config/constants.js';

export async function creerTraversee(cfg, banque) {
  const pistes = Object.keys(cfg.dehors);

  // Le scellement porte les durees du RETOUR par defaut : c'est lui le moment
  // que la sequence existe pour produire. L'aller les remplace a l'appel.
  const scellement = creerScellement({
    sortie: bus(),
    dbOuvert: 0,          // le niveau de chaque piste est porte par la piste
    dbFerme: cfg.dbDedans,
    tFiltre: SCELLEMENT_T_FILTRE,
    tVolume: SCELLEMENT_T_VOLUME,
  });

  await Promise.all(pistes.map((n) => banque.obtenir(n, scellement.entree)));

  // TROIS etats, jamais deduits d'une courbe. Le franchissement est un
  // EVENEMENT A UNE IMAGE : avant le seuil les couches exterieures sont
  // PLATES et au niveau interieur, apres elles y reviennent. Une courbe sur le
  // segment les ferait monter avant l'evenement, et on entendrait les oiseaux
  // et la rue a travers le verre alors qu'on est encore dedans.
  const AVANT = 'avant', DEHORS = 'dehors', APRES = 'apres';

  /** Pose l'etat interieur : couches exterieures plates et basses, scelle. */
  function poserInterieur(immediat) {
    for (const n of pistes) {
      banque.viser(n, cfg.dbDehorsAvant, immediat ? 0.01 : SCELLEMENT_T_VOLUME);
    }
    banque.viser('ville-interieure', cfg.dbVilleInterieure, immediat ? 0.01 : 1.5);
    scellement.fermer(1, immediat
      ? { immediat: true }
      : { tFiltre: SCELLEMENT_T_FILTRE, tVolume: SCELLEMENT_T_VOLUME });
  }

  let etat = AVANT;
  poserInterieur(true);

  return {
    /**
     * @param {number} image index d'image courant
     */
    suivre(image) {
      const voulu = image < cfg.sortie ? AVANT
                  : image < cfg.retour ? DEHORS
                  : APRES;
      if (voulu === etat) return;
      etat = voulu;

      if (etat === DEHORS) {
        // L'ALLER : tout arrive ENSEMBLE, filtre et volume, en trois dixiemes.
        // On ne franchit pas une vitre progressivement -- une fois le verre
        // passe il n'y a physiquement plus rien entre dedans et dehors.
        for (const n of pistes) banque.viser(n, cfg.dehors[n], TRAVERSEE_T_ALLER);
        // La ville interieure n'a plus lieu d'etre : on EST dehors.
        banque.viser('ville-interieure', -60, TRAVERSEE_T_ALLER);
        scellement.fermer(0, { tFiltre: TRAVERSEE_T_ALLER, tVolume: TRAVERSEE_T_ALLER });
        return;
      }

      // LE RETOUR, et l'AVANT si le visiteur remonte : le filtre court devant,
      // le volume traine derriere. Les niveaux des pistes redescendent au
      // niveau interieur, et la ville interieure revient au seuil de l'audible
      // -- sans elle la demi-seconde ne mene nulle part : on refermerait sur du
      // vide au lieu de refermer sur une piece.
      poserInterieur(false);
    },

    taire() {
      for (const n of pistes) banque.viser(n, -60, 1.5);
      scellement.fermer(1, { immediat: true });
      etat = AVANT;
    },
  };
}
```

#### Le réutiliser sur plusieurs scènes

Une instance par segment qui déclare `traversee`. Rien à changer dans le module :
`creerScene` le construit déjà à la demande.

```js
const traversee = seq.traversee ? await creerTraversee(seq.traversee, banque) : null;
...
if (traversee) traversee.suivre(image);
```

Deux points de vigilance quand il y en a plusieurs :

**Chaque instance crée son propre scellement**, donc son propre filtre. Les
pistes extérieures sont routées vers `scellement.entree` **au moment où la banque
les crée**. Une piste ne peut être routée qu'une fois : si deux traversées
déclarent la même piste dans leur `dehors`, la seconde la récupérera depuis la
banque **déjà branchée sur le filtre de la première**, et son scellement à elle
n'aura aucun effet.

C'est le seul endroit où la banque partagée se retourne contre vous. Trois
issues, par ordre de préférence :

1. **Une seule traversée « propriétaire » par piste.** Si deux scènes sortent sur
   le même paysage, faites-en une seule instance partagée, portée par le segment,
   et donnez-lui deux couples de seuils.
2. **Des pistes distinctes** par façade — `dehors-nord`, `dehors-cour`. C'est
   souvent juste de toute façon : deux côtés d'un bâtiment ne sonnent pas pareil.
3. Router la piste vers un scellement **commun** créé une fois, et ne laisser aux
   comportements que le pilotage. Plus propre, mais c'est une refonte.

**Vérifiez-le tout de suite**, pas à la fin : le symptôme est qu'une des deux
fenêtres ne s'entend pas se fermer, et il se diagnostique très mal à l'oreille.

**Et le retour compte autant que l'aller.** Le visiteur peut remonter. Les trois
états sont recalculés à chaque trame depuis l'index d'image, donc remonter
rejoue le mouvement dans l'autre sens sans rien de spécial à écrire — à condition
de ne jamais déduire l'état d'un événement passé, mais toujours de la position.

### 6.8 Transposer la palette : un site qui n'est pas en ville

Parkside est à Brickell, en plein centre de Miami. **Si votre bâtiment est à la
campagne ou en périphérie, ne vous contentez pas de baisser le gain des pistes
de ville.** Ça ne marchera pas, et pour trois raisons distinctes.

D'abord, mesurez ce que la ville fait vraiment dans le mix de Parkside — elle
n'est pas un fond :

| Où | Niveau |
|---|---|
| `ville-proche`, fin de `01-facade` | **−8 dB**, l'élément extérieur le plus fort de la page |
| `ville-lointaine`, `10-toit` | −12 → −30, c'est le **dernier son du site** |
| ce que la vitre révèle en `08` | `ville-lointaine: −10`, **plus fort que le parc à −12** |

#### 1. Un lointain n'est pas un fort baissé

Ce qui change avec la distance, c'est le **spectre** avant le niveau : l'air et le
feuillage absorbent les aigus bien plus vite que les graves. Une ville à −35 dB
garde ses passages de voiture, ses freins, ses klaxons — l'oreille identifie
« circulation » sur les transitoires et les hautes fréquences, pas sur le volume.

Il faut donc un **passe-bas, pas un fader**. Appliquez-le **à l'encodage** plutôt
qu'à l'exécution : ça ne coûte rien au runtime, et le fichier devient assez pauvre
en haut pour descendre à 64 kbit/s.

```bash
ffmpeg -i vallee.wav -af "lowpass=f=1200" -b:a 64k vallee.mp3
```

#### 2. Les événements identifiables sont le vrai indice

À la campagne, on n'entend pas une voiture *individuelle*. Une piste équivalente à
`ville-proche` ne se baisse pas, elle **se retire**. Gardez-la au plus pour une
scène au niveau du sol s'il y a une route.

Renommez honnêtement ce qui reste — `vallee`, `route-lointaine` — pour que
personne ne cherche une ville dans le fichier.

#### 3. LE POINT QUI COMPTE : le scellement a besoin de quelque chose à sceller

`SCELLEMENT_FILTRE_FERME = 200` Hz. Fermer supprime tout au-dessus de 200 Hz.
**Si dehors il ne reste qu'un grondement grave, fermer une fenêtre ne change
presque rien** — et vous perdez la démonstration d'isolation acoustique, qui est
l'argument commercial du site. Le mécanisme tournerait, sans rien à démontrer.

La bonne nouvelle : sur Parkside le scellement porte déjà sur
`['ville-proche', 'parc-jour']`. **Il agit déjà sur le parc.** À la campagne il
continue de fonctionner, sur les oiseaux au lieu des voitures — et c'est plus
fort. Une fenêtre qui coupe le chant des oiseaux se ressent mieux qu'une fenêtre
qui coupe la circulation.

**Conséquence pratique : il faut une couche extérieure qui a des aigus.** Du
feuillage dans le vent, par exemple. C'est elle qui donne prise au scellement et
qui empêche les scènes de sonner vides. Sans elle, ni la fenêtre ni la traversée
de vitre ne s'entendent.

#### Ce qui remplace le moteur narratif

Toute l'arche de Parkside est « le parc est dessous, la ville a gagné », puis
`10-toit` qui est explicitement la première séquence jouée à l'envers. Si la ville
est quasi absente, **cette arche ne tourne plus sur rien**.

Décidez ce qui la remplace avant de régler quoi que ce soit. Le plus évident est
le **jour vers la nuit**, qui existe déjà dans le moteur :

```js
'parc-jour': { debut: -24, fin: -60, bosse: 0.40, dbBosse: -13 },
'parc-nuit': { debut: -60, fin: -17, retard: 0.42 },
```

#### La palette transposée

| Parkside | Site de campagne | Note |
|---|---|---|
| `ville-proche` | **supprimée** | ses événements sont le tell |
| `ville-lointaine` | `vallee` | ré-encodée passe-bas, 64 kbit/s |
| `ville-interieure` | `dehors-interieur` | la version filtrée du NOUVEAU dehors |
| — | `feuillage` | **à ajouter**, c'est elle qui porte les aigus |
| `parc-jour`, `parc-nuit` | inchangées | mais montées : elles sont le sujet, plus le dessous |
| `vent` | inchangée | voir le piège ci-dessous |

#### Deux pièges de transposition

**Le vent va se mettre à boucler.** `vent.mp3` fait 45 s, sous le minimum de 60 à
90 s. C'était validé **parce que** le vent était enterré entre −16 et −30 sous la
ville. S'il passe au premier plan, 45 s s'entendront comme une boucle. À
réenregistrer plus long.

**Les formes de courbes ne se transposent pas.** Elles ont été réglées pour que la
ville *recouvre* le parc — les `bosse`, les `retard`, les croisements. Ce n'est pas
un décalage global à appliquer : ces formes sont à repenser, pas à translater.

---

## 7. L'eau en WebGL

### 7.1 Ce que fait cet écran, et ce qu'il ne fait pas

C'est **le seul endroit du site qui utilise WebGL**. Partout ailleurs, canvas 2D.

C'est aussi le seul écran construit pour **retenir** quelqu'un plutôt que pour le
faire avancer : l'eau répond au curseur et au doigt, et **elle continue de bouger
quand le défilement s'est arrêté**. C'est le moment dont le visiteur parlera.

Le principe qui rend l'écran tenable : **on ne dessine pas une eau, on déforme
une photographie.** Le fond du bassin, les parois, les caustiques, la couleur de
l'eau à chaque heure du jour sont déjà dans l'image et déjà justes. Les simuler
les doublerait, et les doublerait moins bien.

La simulation ne sert donc qu'à deux choses :

1. **décaler l'échantillonnage de la plaque** par la normale de la surface — c'est
   la photographie elle-même qui ondule, donc elle reste juste à toute heure ;
2. **ajouter un éclat spéculaire** calculé sur la même normale — une réfraction
   déplace, elle n'allume pas.

En mode dégradé, pas de bassin du tout : `reglages()` rend `eau: !etat.actif`, et
le toit reste une belle image fixe.

### 7.2 Les constantes de simulation — à recopier à la valeur près

Elles viennent du projet d'origine (Rouvière), où elles ont été réglées à la main
contre l'œil. **Aucune ne se devine, aucune ne s'arrondit** : les changer revient
à refaire ce réglage, pas à ajuster un paramètre.

```js
// --- la grille et le pas de temps
export const RESOLUTION = 256;
export const PAS = 1 / 60;
export const PAS_PAR_CADRE = 2;
export const MAX_SOUS_PAS = 3;

// --- la goutte du pointeur
export const GOUTTE_RAYON = 0.03;
export const GOUTTE_BASE = 0.004;
export const GOUTTE_AMPLITUDE = 0.016;

// --- la vitesse du pointeur
export const VITESSE_PLEINE = 30;      // px par trame, ou tout est a fond
export const LISSAGE_VITESSE = 0.12;

// --- le clic
export const CLIC_FORCE = 0.05;
export const CLIC_RAYON = 0.05;

// --- l'amorcage : vingt gouttes alternees, pour que l'eau ne soit jamais plate
export const AMORCE_NOMBRE = 20;
export const AMORCE_FORCE = 0.01;

// --- bornage de la file
export const MAX_GOUTTES_PAR_CADRE = 4;

// --- les gouttes ambiantes
export const AMBIANT_NOMBRE = 3;
export const AMBIANT_FORCE = 0.0055;
export const AMBIANT_RAYON = 0.035;
export const AMBIANT_PERIODE = 1.6;
export const AMBIANT_MULT_ACTIF = 0.35;
export const INACTIF = 2.2;
```

**Les gouttes ambiantes ne sont pas un ornement.** Ce sont elles qui font que
l'eau reste vivante quand personne ne la touche, et c'est exactement ce que
l'écran exige. Sans elles la surface se fige dès qu'on lâche la souris, et
l'écran construit pour retenir quelqu'un devient une image. Trois sources qui
dérivent lentement, une goutte toutes les 1,6 s environ, et **trois fois moins
fortes tant que le visiteur touche encore l'eau** (`AMBIANT_MULT_ACTIF`), sinon
les siennes seraient noyées dans la pluie de fond.

Le générateur aléatoire est **à graine** : deux visites donnent la même pluie.

```js
function aleatoireAGraine(graine) {
  let e = graine >>> 0;
  return () => {
    e = (e + 0x6d2b79f5) >>> 0;
    let t = Math.imul(e ^ (e >>> 15), 1 | e);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

### 7.3 Les shaders : ce qui se copie mot pour mot, et ce qu'il ne faut surtout pas reprendre

#### À copier VERBATIM du projet d'origine

Quatre blocs, depuis le fichier `src/components/gl/materiaux/bassin.ts` **du
projet d'origine** — ce chemin n'existe pas dans ce depot-ci. Ils ne se
réécrivent pas, ne s'« améliorent » pas et ne se retapent pas de mémoire : la
décroissance en cosinus de la goutte, les trois lignes de l'onde et la normale
dans les canaux `ba` sont exactement celles qui ont été réglées là-bas.

| Bloc | Origine |
|---|---|
| `SOMMET_PLEIN_CADRE` | le plan plein cadre des passes |
| `FRAGMENT_GOUTTE` | `shaders/water/drop.frag.wgsl` |
| `FRAGMENT_SIMULATION` | `shaders/water/update.frag.wgsl` |
| `FRAGMENT_NORMALE` | `shaders/water/normal.frag.wgsl` |

**Une seule adaptation, et elle est mécanique** : la source tourne sous three.js,
qui injecte lui-même `position`, `uv`, `projectionMatrix` et `modelViewMatrix`.
Ici il n'y a pas de three.js — le budget de 250 ko de JS ne le permet pas pour un
seul écran — donc ces déclarations sont écrites à la main. **Le corps des
fonctions est intact.**

Le cœur de l'onde, pour que vous puissiez vérifier votre copie :

```glsl
    /* La vitesse gagne l'ecart a la moyenne des voisins, perd un demi-pour-cent
       par pas, et la hauteur l'integre. Trois lignes, et c'est toute l'onde. */
    info.g += (moyenne - info.r) * 2.0;
    info.g *= 0.995;
    info.r += info.g;
```

Et la goutte, dont la décroissance est **en cosinus, pas gaussienne** :

```glsl
    float goutte = max(0.0, 1.0 - length(uCentre * 0.5 + 0.5 - vUv) / uRayon);
    goutte = 0.5 - cos(goutte * 3.14159265) * 0.5;
    info.r += goutte * uForce;
```

#### À NE PAS reprendre

Ces blocs du projet d'origine dessinent une eau inventée, avec sa couleur, sa
transparence, ses reflets et ses caustiques. Ici tout cela est **déjà dans la
photographie, et juste**. Les reprendre reviendrait à peindre une seconde eau
par-dessus la vraie.

```
CHUNK_CUBE       CHUNK_ETENDUE      CHUNK_PLAN       CHUNK_MUR
SOMMET_BASSIN    SOMMET_CAUSTIQUE   FRAGMENT_CAUSTIQUE
```

#### À écrire : le shader de surface

`FRAGMENT_SURFACE` est **écrit, pas copié**. Il ne fait que les deux choses de la
§7.1, plus les occultants. Sa structure :

```glsl
  // 1. Repere. La plaque et toutes les coordonnees relevees a la main sont en
  //    repere image, origine EN HAUT a gauche ; WebGL met l'origine des UV en
  //    BAS. On retourne ici, une seule fois.
  vec2 uvIm = vec2(vUv.x, 1.0 - vUv.y);

  // 2. Le carre unite de la simulation, vu depuis ce pixel de la plaque.
  vec3 h = uVersUnite * vec3(uvIm, 1.0);
  vec2 unite = h.xy / h.z;

  // 3. Hors du bassin, ou derriere un occultant : la plaque, intacte.
  float masque = texture2D(uMasque, uvIm).r;
  bool dansBassin = unite.x > 0.0 && unite.x < 1.0
                 && unite.y > 0.0 && unite.y < 1.0;
  if (!dansBassin || masque > 0.5) {
    gl_FragColor = texture2D(uPlaque, uvIm);
    return;
  }

  // 4. La normale de la simulation.
  vec4 info = texture2D(uEtat, unite);
  vec3 normale = vec3(info.b, sqrt(max(0.0, 1.0 - dot(info.ba, info.ba))), info.a);

  // 5. Le decalage, adouci pres des bords : une onde qui pousse
  //    l'echantillonnage au-dela du quadrilatere irait chercher du carrelage
  //    sec et le ferait onduler.
  vec2 bord = min(unite, 1.0 - unite);
  float marge = smoothstep(0.0, 0.06, min(bord.x, bord.y));
  vec2 decalage = normale.xz * uRefraction * marge;
  vec3 couleur = texture2D(uPlaque, uvIm + decalage).rgb;
```

Puis l'éclat, §7.6.

### 7.4 L'homographie VARIABLE — la vraie différence avec Parkside

#### Le problème

Sur Parkside, le plan de la piscine est **quasiment fixe** : les quatre coins
relevés sur la première et la dernière image ne diffèrent que de quelques pixels.

```js
// mesure sur les 241 images du plan de Parkside
export const BASSIN_COINS_PREMIERE = {
  HG: [498, 400], HD: [760, 400], BD: [1279, 610], BG: [0, 611],
};
export const BASSIN_COINS_DERNIERE = {
  HG: [495, 399], HD: [759, 398], BD: [1279, 610], BG: [0, 610],
};
```

Deux jeux et une interpolation linéaire y suffisaient largement.

**Sur le nouveau site, la piscine dérive pendant le plan.** Quatre coins figés
produiraient une eau qui se décale de l'image — imperceptiblement d'abord, puis
franchement au bord le plus éloigné, parce que c'est là que la perspective
amplifie le moindre écart angulaire.

#### La solution : N repères, interpolation des POINTS

**On interpole les quatre points, pas la matrice.** C'est plus simple, plus
stable, et parfaitement suffisant pour une dérive lente. Ne décomposez pas et ne
recomposez pas une matrice d'homographie : ce serait de la complexité pour rien,
et une interpolation de matrices n'a de toute façon pas de sens géométrique
simple.

Deux repères suffisent si la dérive est régulière. **Le système en accepte
davantage** pour qu'on puisse en ajouter un au milieu, sans rien réécrire, si
elle ne l'est pas.

#### Le code

`carreVers` et `inverser` se copient tels quels de `src/water/homographie.js`.
`carreVers` est la forme fermée de Heckbert (*Fundamentals of Texture Mapping and
Image Warping*) pour le cas carré vers quadrilatère, et rend la matrice **en
colonnes**, prête pour `uniformMatrix3fv` sans transposition.

**Remplacez `versUnite` par ceci** — code exécuté et vérifié avant d'être écrit
dans ce document :

```js
/**
 * L'homographie de la plaque VERS le carre unite, a la progression `t`.
 *
 * `reperes` est une liste triee par `t` croissant :
 *
 *   [ { t: 0,    coins: { HG:[x,y], HD:[x,y], BD:[x,y], BG:[x,y] } },
 *     { t: 0.5,  coins: { ... } },          // facultatif, si la derive n'est
 *     { t: 1,    coins: { ... } } ]         // pas reguliere
 *
 * On interpole les QUATRE POINTS de proche en proche, puis on construit la
 * matrice a partir des points interpoles. On n'interpole jamais la matrice
 * elle-meme : une moyenne de deux homographies n'est pas l'homographie de la
 * moyenne des points, et la difference se voit au bord le plus lointain.
 *
 * Les coordonnees sont normalisees par la taille de la plaque, parce que le
 * shader travaille en UV et non en pixels.
 */
export function versUniteN(reperes, t, largeur, hauteur) {
  if (reperes.length === 0) throw new Error('aucun repere de calage');
  if (reperes.length === 1) return matriceDe(reperes[0].coins, largeur, hauteur);

  // L'intervalle qui contient t. Hors bornes, on prend le premier ou le dernier
  // et `k` sera borne a 0 ou 1 : le calage ne s'extrapole pas.
  let i = 1;
  while (i < reperes.length - 1 && t > reperes[i].t) i++;
  const a = reperes[i - 1], b = reperes[i];
  const denom = b.t - a.t;
  const k = denom === 0 ? 0 : Math.min(Math.max((t - a.t) / denom, 0), 1);

  const coins = {};
  for (const nom of ['HG', 'HD', 'BD', 'BG']) {
    const p = a.coins[nom], q = b.coins[nom];
    coins[nom] = [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k];
  }
  return matriceDe(coins, largeur, hauteur);
}

function matriceDe(coins, largeur, hauteur) {
  const n = (p) => [p[0] / largeur, p[1] / hauteur];
  // Le carre unite : (0,0) au coin haut-gauche du bassin, (1,1) au bas-droite.
  return inverser(carreVers(n(coins.HG), n(coins.HD), n(coins.BD), n(coins.BG)));
}
```

#### La configuration correspondante

```js
// src/config/bassin.js
export const BASSIN_REPERES = [
  { t: 0.0, coins: { HG: [498, 400], HD: [760, 400], BD: [1279, 610], BG: [0, 611] } },
  { t: 1.0, coins: { HG: [495, 399], HD: [759, 398], BD: [1279, 610], BG: [0, 610] } },
];
```

Ajouter un repère médian se fait en insérant une ligne, dans l'ordre des `t`.

#### Vérification exécutée

```
4 coins -> carre unite, pire erreur sur 7 valeurs de t : 1.78e-15
saut de matrice au repere median :                       4.67e-04
2 reperes, HG a mi-course ->                            -8.88e-16  0.00e+00
un seul repere : ok
```

Le premier chiffre est le critère : à n'importe quel `t`, les quatre coins
interpolés retombent sur `(0,0) (1,0) (1,1) (0,1)` à la précision machine. Le
second confirme qu'il n'y a **pas de saut** au passage d'un repère — 4,67e-4 est
l'écart de différence finie entre `t = 0.4999` et `t = 0.5001`, pas une
discontinuité.

**Le banc à écrire d'abord** : ce test tient en trente lignes et il vous fera
gagner des heures. Vérifiez-le avant de brancher quoi que ce soit sur le shader.

### 7.5 Ce qui doit être remesuré, et ne se copie pas

Trois choses sont propres à la piscine de Parkside.

**Les repères de calage** — voir §8, l'outil.

**Les occultants** : ce qui est DEVANT la surface et doit être redessiné
par-dessus l'eau. Sur Parkside, les deux barres métalliques d'une échelle qui
plongent dans l'eau, larges de quelques pixels, à détourer à la loupe. Sans
elles, l'eau ondule par-dessus l'acier.

On les redessine en échantillonnant l'**image courante**, jamais une image figée,
sinon leur lumière cesserait de suivre la tombée du jour.

Deux pièges relevés sur Parkside :

- Les objets **entièrement sous la ligne d'eau** n'ont pas besoin de masque : les
  bains de soleil commencent à `y = 612` quand le bord proche du quadrilatère
  court à `y = 610`, et l'eau n'est jamais dessinée hors du quadrilatère. Ne
  détourez que ce qui **traverse** la ligne d'eau.
- Si vous relevez les occultants **deux fois** (première et dernière image), les
  deux tracés n'auront pas le même nombre de sommets — 15 puis 18, 20 puis 19 sur
  Parkside — et l'interpolation sommet à sommet est impossible. La parade est un
  **rééchantillonnage par longueur d'arc** à un nombre fixe de sommets
  (`SOMMETS = 48`), après quoi les points se correspondent :

```js
function reechantillonner(contour, n) { /* voir src/config/bassin.js */ }
```

**Le miroitement du soleil.** Sur Parkside, l'éclat spéculaire suit le vrai soleil
du plan, et il le suit **par la mesure** : dans le quadrilatère, l'eau est partout
cyan sauf sous le soleil, donc `rouge moins bleu` isole la traînée sans
ambiguïté. On en relève le barycentre, l'écart-type et la chaleur sur les 241
images, ramenés au carré unité.

Pourquoi la mesure et non un modèle : **la focale du rendu n'est pas récupérable
des quatre coins seuls.** Les deux bords longs du bassin sont parallèles dans
l'image, leur point de fuite est à l'infini, et la contrainte d'orthogonalité ne
donne alors que le point principal, jamais la focale. Il aurait fallu la deviner.
Lire la réponse sur l'image évite entièrement la question — et surtout, la
réponse ne peut pas être en désaccord avec l'image, puisque c'est l'image.

Si le nouveau plan a un soleil visible, refaites cette mesure. S'il n'en a pas,
mettez `ECLAT_SOLEIL` à zéro partout et ne gardez que le terme nocturne.

### 7.6 L'éclairage de l'eau suit la nuit

#### Le problème

Les constantes d'éclairage d'un shader sont fixes. Sur un plan où la nuit tombe
et où les lumières du bassin s'allument, **l'eau garderait son reflet de plein
jour au milieu d'une scène de nuit**.

Et il ne suffit pas de l'assombrir : **une eau simplement baissée en luminosité a
l'air morte.** La nuit, elle ne perd pas son éclat, elle en change — elle gagne
les points de lumière des lampes immergées.

#### Le mécanisme : deux termes, une seule progression

Un uniform unique piloté par la même progression de défilement que le fondu vers
la nuit. Il alimente deux termes **de nature différente**, et c'est cette
différence de nature qui empêche l'eau de mourir.

```glsl
  uniform vec3 uSoleil;   // teinte du soleil, DEJA multipliee par sa force
  uniform vec3 uNuit;     // teinte des projecteurs, idem
  uniform vec2 uMiroir;   // centre du miroitement, carre unite
  uniform vec2 uEtendue;  // etendue du miroitement
  uniform vec2 uPencher;  // inclinaison de la normale exigee, azimut du soleil
  uniform float uDurete;
  uniform float uAmpli;   // raidissement de la normale, POUR LE SEUL ECLAT
```

```glsl
  /* La ride, que la simulation ne porte pas : une normale raidie, qui ne sert
     qu'a l'eclat. La refraction garde la vraie pente -- une ride capillaire
     fait scintiller, elle ne deplace pas le fond du bassin. */
  vec3 ridee = normalize(vec3(info.b * uAmpli, 1.0, info.a * uAmpli));

  vec3 versOeil = normalize(vec3(0.0, 1.0, 0.35));
  float fresnel = FRESNEL_MIN
                + (1.0 - FRESNEL_MIN) * pow(1.0 - max(0.0, dot(ridee, versOeil)), 5.0);

  /* LE SOLEIL : un chemin, une direction, un lobe dur. Une facette n'allume que
     si elle est sur le chemin -- c'est ce qui donne une trainee et non un
     vernis uniforme sur tout le bassin. */
  vec2 ecart = (unite - uMiroir) / uEtendue;
  float chemin = exp(-dot(ecart, ecart));
  vec3 exigee = normalize(vec3(uPencher.x, 1.0, uPencher.y));
  float lobe = pow(max(0.0, dot(ridee, exigee)), uDurete);

  /* LA NUIT : les projecteurs immerges eclairent par en dessous. Leur eclat n'a
     ni chemin ni direction, il prend n'importe quelle facette un peu inclinee.
     C'est CE terme qui empeche l'eau de nuit d'avoir l'air morte. */
  float pente = clamp(length(ridee.xz) * 3.0, 0.0, 1.0);

  couleur += uSoleil * lobe * chemin * fresnel
           + uNuit * pente * pente * fresnel;
```

Le terme nocturne est **sans direction et sans chemin** : c'est ce qui le rend
juste. Une lumière qui vient d'en dessous scintille partout à la fois, pas dans
une traînée.

#### Côté JavaScript

```js
const soleil = lire(ECLAT_SOLEIL, t) * GAIN_SOLEIL * force;
const nuit   = lire(ECLAT_NUIT, t)   * GAIN_NUIT   * force;
gl.uniform3f(u.uSoleil, TEINTE_SOLEIL[0]*soleil, TEINTE_SOLEIL[1]*soleil, TEINTE_SOLEIL[2]*soleil);
gl.uniform3f(u.uNuit,   TEINTE_NUIT[0]*nuit,     TEINTE_NUIT[1]*nuit,     TEINTE_NUIT[2]*nuit);
```

```js
export const TEINTE_SOLEIL = [1.00, 0.94, 0.82];   // chaud
export const TEINTE_NUIT   = [0.72, 0.92, 1.00];   // froid
export const GAIN_SOLEIL = 0.85;
export const GAIN_NUIT   = 0.30;
export const DURETE = 220.0;
export const OBLIQUITE = 0.18;
export const OEIL_UV = [0.49, 1.30];
export const ETALEMENT = 1.15;
```

Les deux courbes sont des tables `[t, valeur]` interpolées. Sur Parkside elles
sont mesurées ; sur le nouveau site, **branchez-les sur la même progression que
le fondu vers la nuit**. La forme minimale, si vous n'avez pas le temps de
mesurer :

```js
export const ECLAT_SOLEIL = [[0.0, 1.0], [0.55, 1.0], [0.70, 0.0], [1.0, 0.0]];
export const ECLAT_NUIT   = [[0.0, 0.0], [0.50, 0.0], [0.70, 0.9], [1.0, 1.0]];
```

Le relais se fait de lui-même : le soleil meurt, les projecteurs prennent la
suite. **Le dernier point de `ECLAT_SOLEIL` doit être à zéro franc** — un
scintillement de soleil sur une eau éclairée aux projecteurs immergés se voit
immédiatement.

Sur Parkside, mesuré : la chaleur du miroitement culmine à l'image 100 et tombe
sous 5 % à l'image 160 ; les projecteurs prennent le relais à partir de
`t = 0,52` et sont pleins à `t = 0,83`.

#### Les deux constantes qui rendent l'éclat visible

Dimensionnées **par la mesure**, après avoir constaté que les valeurs posées à vue
étaient inopérantes. C'est le piège 9 de la §9 ; retenez les deux valeurs.

```js
export const REFRACTION = 0.07;     // et non 0.012
export const AMPLI_PENTE = 4.0;
```

### 7.7 L'ordre par trame ne change pas

```
gouttes en attente  ->  PAS_PAR_CADRE passes de simulation  ->  UNE passe de normale
```

La passe de normale ne se joue **qu'une fois**, après les pas. La rejouer à chaque
sous-pas ferait payer à la trame lente un travail qu'elle n'a pas les moyens de
faire.

Pas de temps **fixe**, avec rattrapage borné :

```js
avancer(dt) {
  amorcer();
  temps += dt;
  accumulateur += Math.min(dt, 0.25);
  let n = 0;
  while (accumulateur >= PAS && n < MAX_SOUS_PAS) {
    collecterAmbiantes(PAS);
    pasPhysique();
    accumulateur -= PAS;
    n++;
  }
  if (n === 0) return;
  passe(prog.normale);
}
```

Au-delà de `MAX_SOUS_PAS = 3`, on **laisse filer** plutôt que d'entrer dans la
spirale où le rattrapage coûte plus que le retard.

La file de gouttes est bornée à `MAX_GOUTTES_PAR_CADRE * 4` : chaque goutte est
une passe complète, et une file qui grossirait plus vite qu'on ne la vide ferait
payer à la trame suivante un retard qu'elle ne rattraperait jamais. Au-delà, la
goutte est perdue — **c'est la bonne perte**.

### 7.8 Le contexte GL, et l'entrée en scène

Deux cibles en ping-pong, **RGBA32F**, filtrage linéaire, bords bloqués, sans
tampon de profondeur. `EXT_color_buffer_float` est **obligatoire** :

```js
if (!gl.getExtension('EXT_color_buffer_float')) {
  throw new Error('EXT_color_buffer_float indisponible');
}
gl.getExtension('OES_texture_float_linear');
```

**Ne mangez pas cette erreur dans un `catch` muet.** Laissez-la remonter et
laissez l'appelant décider de dégrader — un bassin qui échoue en silence est un
bassin qu'on ne saura jamais réparer.

L'entrée en scène demande deux précautions, chacune corrigeant un défaut visible :

```js
// Le bassin ne prend PAS l'ecran pendant le fondu d'entree : il ne sait
// melanger que la houle, pas deux clips.
if (index === SEQUENCES.length - 1 && seq.eau && bmp && t >= partFondu) {
  const b = bassinPour();
  if (b) {
    // La houle MONTE au lieu d'apparaitre. A force nulle le bassin rend la
    // plaque intacte, donc l'echange des deux canvas ne se voit pas.
    const force = Math.min((t - partFondu) / EVEIL_BASSIN, 1);   // EVEIL_BASSIN = 0.06
    b.trame(bmp, t, dt, (v) => scenes.get(index)?.eauSuivre(v), { force });
    rendupParBassin = true;
  }
}
```

`force` multiplie `uRefraction` et les deux éclats. Six pour cent du segment, soit
un peu plus d'une seconde au défilement normal.

### 7.9 Le son de l'eau

C'est le seul son du site qui n'obéit pas au défilement mais **à la main**, et le
seul dont le gain est linéaire.

```js
suivre(vitesse) {
  let cible, tau;
  if (vitesse === null) { cible = 0; tau = EAU_T_SORTIE; }   // 0.4 s
  else {
    const part = Math.min(vitesse / VITESSE_PLEINE, 1);
    cible = part * EAU_GAIN_MAX;                             // 0.6
    tau = EAU_T_GAIN;                                        // 0.08 s
  }
  if (Math.abs(cible - gain) < 1e-4) return;
  gain = cible;
  banque.viserLineaire('eau', cible, tau);
}
```

`EAU_T_GAIN = 0.08` s est **le chiffre critique de la scène**. La commande arrive
image par image ; sans ce lissage le gain saute en escalier et l'on entend un
grésillement. Avec, la main est suivie sans latence perceptible.

La même vitesse lissée du pointeur creuse l'onde ET ouvre le gain : **ce qu'on
entend est exactement ce qu'on voit.**

`EAU_GAIN_MAX = 0.6` vient d'un site où tout le reste est coupé quand on arrive au
bassin : il y a été calibré **contre du silence**. Ici l'eau s'ajoute à un paysage
et ne le remplace pas. C'est une valeur de départ, à régler à l'oreille contre le
vent. Voir aussi le piège 7 de la §9, qui concerne cette piste précisément.

---

## 8. L'outil de calage des coins

### 8.1 Celui de Parkside

**Où il vit** : `tools/editeur-bassin.html`, 344 lignes, une seule page sans
dépendance, module ES en ligne.

**Comment on le lance** :

```bash
python tools/serve.py            # sert la racine du depot sur :8000
# puis http://localhost:8000/tools/editeur-bassin.html
```

Il lit directement les images livrées :

```js
im.src = `/frames/webp-1280/10-toit/${String(i).padStart(4,'0')}.webp`;
```

**Ce qu'il fait**, dans l'ordre où on s'en sert :

*Un curseur d'image* sur toute la séquence (`min=1 max=241`), pour aller voir
n'importe quelle image du plan.

*Deux modes*, en deux boutons : `1. Coins` et `2. Masque`.

*En mode coins*, deux jeux — « première image » et « dernière image ». Cliquer sur
un jeu **saute à l'image correspondante**, ce qui évite de caler la dernière
image en regardant la première. Les quatre points sont jaunes et se glissent à la
souris ; leurs coordonnées sont écrites à côté d'eux.

*Une loupe ×6*, et elle est indispensable. 180 px de diamètre, `imageSmoothingEnabled = false`
pour voir les pixels réels, une croix au centre :

```js
const Z = 6, S = 180 / Z;
lctx.imageSmoothingEnabled = false;
lctx.drawImage(im, souris[0]-S/2, souris[1]-S/2, S, S, 0, 0, 180, 180);
```

Sans elle, on ne détoure pas des barres métalliques de quelques pixels de large.

*En mode masque*, on pose des polygones point par point : « nouveau polygone »,
« fermer » (ou double-clic), « annuler le dernier point », « supprimer le polygone
sous le curseur », plus un compteur en direct du nombre de polygones enregistrés.
Un bouton « caler sur la dernière image » permet de **décaler en bloc** le masque
pour la dernière image, si les silhouettes ont dérivé.

*Persistance* : tout est gardé dans le navigateur, on peut recharger sans perdre
son travail.

```js
const CLE = 'parkside-bassin';
let d = JSON.parse(localStorage.getItem(CLE) || 'null') || structuredClone(DEFAUT);
const garder = () => localStorage.setItem(CLE, JSON.stringify(d));
```

*Export* : un bouton remplit un `<textarea>` et le sélectionne, prêt à coller.

### 8.2 Le format de sortie, avec un exemple réel

L'export produit **exactement le texte à coller dans `src/config/bassin.js`** :

```js
// Releve dans tools/editeur-bassin.html, sur la sequence 10-toit.
// Le plan n'est pas fixe : les coins de la derniere image different de ceux de
// la premiere, et le code interpole lineairement sur l'index d'image.
export const BASSIN_COINS_PREMIERE = { HG: [498,400], HD: [760,400], BD: [1279,610], BG: [0,611] };
export const BASSIN_COINS_DERNIERE = { HG: [495,399], HD: [759,398], BD: [1279,610], BG: [0,610] };

// Les occultants : ce qui est DEVANT la surface et doit etre redessine
// par-dessus l'eau, en echantillonnant l'image courante -- les deux barres
// metalliques, les bains de soleil et la table basse.
export const BASSIN_OCCULTANTS = [
  [[880,530], [884,536], [889,548], ..., [872,533]],
  [[357,538], [361,545], ..., [349,541]],
];
```

Un ordre de grandeur relevé sur Parkside : les deux barres métalliques ont été
tracées avec 15 et 20 sommets sur la première image, 18 et 19 sur la dernière.

### 8.3 La version dont vous avez besoin

Trois changements par rapport à celui de Parkside.

**1. N repères au lieu de deux.** Remplacez les deux boutons de jeu par une liste
de repères, chacun avec sa position `t` dans le segment :

```
[ + ajouter un repere a l'image courante ]

  t = 0.000   image 1     [ editer ]  [ supprimer ]
  t = 0.500   image 121   [ editer ]  [ supprimer ]
  t = 1.000   image 241   [ editer ]  [ supprimer ]
```

« Éditer » saute à l'image du repère et rend ses quatre points glissables.
« Ajouter » crée un repère à l'image courante, **initialisé par interpolation des
repères voisins** — le repère médian part donc de la position qu'il aurait sans
lui, et l'on ne corrige que la dérive.

L'export devient :

```js
export const BASSIN_REPERES = [
  { t: 0.000, coins: { HG: [498,400], HD: [760,400], BD: [1279,610], BG: [0,611] } },
  { t: 0.500, coins: { HG: [470,392], HD: [742,390], BD: [1262,600], BG: [12,604] } },
  { t: 1.000, coins: { HG: [430,381], HD: [715,377], BD: [1240,588], BG: [30,595] } },
];
```

Triez par `t` croissant à l'export : `versUniteN` le suppose.

**2. Image à taille réelle, et précision au pixel.** Le canvas est déjà en
1280 × 720 ; gardez-le à `width: 100%` mais **vérifiez que la conversion
souris vers pixels source tient compte du facteur d'échelle** :

```js
function pos(e) {
  const r = c.getBoundingClientRect();
  return [(e.clientX - r.left) * (c.width / r.width),
          (e.clientY - r.top)  * (c.height / r.height)];
}
```

Quelques pixels d'erreur sur un coin donnent un décalage visible sur le bord
opposé du bassin : c'est la perspective qui amplifie. Ajoutez les flèches du
clavier pour déplacer le point attrapé d'un pixel à la fois.

**3. Prévisualisation de l'eau simulée, par-dessus l'image.** C'est le point qui
fait gagner le plus de temps : juger le calage sans recompiler.

Le plus simple est de **réutiliser le module du bassin** plutôt que de réécrire un
rendu :

```js
const { creerBassin } = await import('/src/water/bassin.js');
const bassin = creerBassin(canvasApercu);
// dans la boucle :
bassin.trame(imageCourante, t, dt, () => {}, { fausses: montrerFaussesCouleurs });
```

Prévoyez une case **fausses couleurs** : le shader de Parkside rend, sous
`uFausses`, la hauteur en rouge et bleu, la pente en vert, le chemin du soleil en
surimpression, et assombrit le hors-bassin. C'est le seul moyen de voir d'un coup
d'œil si le quadrilatère colle vraiment à l'eau et si le masque tombe bien sur les
barres. Deux minutes de travail, et ça a trouvé les deux erreurs de calage de
Parkside.

**Une mise en garde de méthode** : la segmentation par couleur du bassin **ne
marche pas**. Elle a été essayée sur Parkside et elle échoue — les reflets
spéculaires cassent les plages contiguës et le contour part dans le décor. Le
repérage à l'œil sur une grille, avec la loupe, marche du premier coup. Ne perdez
pas une heure là-dessus.

---

## 9. Les pièges déjà rencontrés

C'est la section la plus précieuse du document. Chacun de ces défauts a coûté du
temps sur Parkside. Vous devriez pouvoir les reconnaître avant de les recréer.

### Le décor : outillage et mesure

**1. Le serveur de développement qui n'écoute qu'en IPv4.**

*Symptôme* : le défilement se bloque dès l'arrivée sur la page ; les images en
retard continuent d'arriver après qu'on a lâché, ce qui se voit comme une vidéo
qui se lit toute seule. Tout semble venir de l'anneau d'images.

*Cause réelle* : écouter sur `0.0.0.0` n'écoute qu'en IPv4. Or un navigateur
résout `localhost` en `::1` **avant** `127.0.0.1` : il tente l'IPv6, attend le
délai d'expiration — **deux secondes pleines** — puis retombe sur IPv4. Mesuré
sur la machine de développement : **2040 ms par requête via `localhost`, 1,2 ms
via `127.0.0.1`**. Chaque image payait ces deux secondes, ce qui affamait
complètement la chaîne de décodage.

*Correctif* : écouter sur `::` avec `IPV6_V6ONLY` à zéro — la même socket accepte
alors les deux familles.

```python
class Serveur(socketserver.ThreadingTCPServer):
    address_family = socket.AF_INET6
    allow_reuse_address = True
    daemon_threads = True
    def server_bind(self):
        try:
            self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        except OSError:
            pass
        super().server_bind()
```

**C'est le piège le plus coûteux de tout le projet** : trois tours à démonter
l'anneau d'images alors que la cause était dans le serveur de test. Copiez
`tools/serve.py` tel quel et ne le réécrivez pas.

**2. Le serveur qui met le code en cache.**

*Symptôme* : on corrige, on recharge, rien ne change. On corrige autrement, rien
ne change.

*Cause* : un `Cache-Control: max-age` global gelait `src/*.js` et `index.html`
pendant une heure. On regardait la version d'avant sans le savoir.

*Correctif* : cache uniquement sur les livrables, `no-store` sur tout le reste.

```python
chemin = self.path.split("?")[0]
if chemin.startswith(("/frames/", "/audio/")):
    self.send_header("Cache-Control", "public, max-age=3600")
else:
    self.send_header("Cache-Control", "no-store, must-revalidate")
```

**3. Comparer deux formats à qualité non appariée.**

*Symptôme* : l'AVIF paraît trois fois plus léger que le WebP. L'arbitrage tombe
tout seul.

*Cause* : on comparait `crf 40` (SSIM 0,950) à `q 72` (SSIM 0,975). Ce n'était
pas un gain de format, c'était une baisse de qualité. À qualité appariée, l'écart
réel est de **1,6×, pas 3×**.

*Correctif* : mesurer le SSIM des deux points **avant** de comparer les poids.
Voir §2.6.

**4. Échantillonner la qualité au milieu des clips.**

*Symptôme* : une qualité choisie sur mesure, et des bandes bien visibles à
l'écran sur les images sombres.

*Cause* : les images de contrôle étaient prises à 2, 7,5 et 13 s. Les vrais pires
cas — l'heure bleue d'une façade à 38 % de zones sombres et lisses, une nuit à
30 % contre 5 % au milieu du même clip — n'étaient pas dans l'échantillon.

*Correctif* : chercher les images difficiles avant de mesurer, et regarder les
planches à 100 %.

**5. Un banc d'acceptation qui vérifie des expressions régulières.**

*Symptôme* : 37 échecs signalés, tous faux.

*Cause* : le banc cherchait les `export` par expression régulière au lieu
d'importer réellement les modules.

*Correctif* : `await import()` les modules et testez les valeurs. Un banc qui
ment est pire qu'aucun banc — vous allez le croire.

**6. Le banc qui s'interbloque sur son horloge virtuelle.**

*Symptôme* : `tools/recette-molette.mjs` affichait son en-tête et plus rien, sans
message d'erreur. Il n'avait **jamais** produit un résultat.

*Cause* : l'horloge virtuelle n'avançait que dans la boucle de trames. Le
décodage simulé attendait l'horloge, l'horloge attendait la boucle, la boucle
attendait le décodage.

*Correctif* : pousser l'horloge à la main tant qu'on est hors de la boucle.

```js
const attendre = async (promesse) => {
  let fini = false;
  promesse.then(() => { fini = true; }, () => { fini = true; });
  while (!fini) { horloge += DT * 1000; await tic(); }
  return promesse;
};
await attendre(anneauPour(0).assurer(1));
```

**7. Tester des vitesses de défilement irréalistes.**

*Symptôme* : le banc de l'anneau passait à toutes les vitesses, et la page gelait
quand même.

*Cause* : il testait 1, 3 et 30 px par trame. Le moteur à impulsions produit
**8, 25 et 83**. Le régime réel n'avait jamais été testé.

*Correctif* : piloter le banc avec le **vrai** moteur de défilement, pas avec des
vitesses inventées.

### Les images et l'anneau

**8. Éviction premier entré, premier sorti.**

*Symptôme* : l'écran se fige au premier aller-retour, alors qu'il tient très bien
en défilement monotone.

*Cause* : le FIFO évince les images **les plus anciennement insérées**, c'est-à-
dire le centre et ses voisines immédiates — exactement celles qu'on affiche.
L'anneau se détruit lui-même à chaque trame.

*Correctif* : évincer **toujours la plus éloignée du centre**, en protégeant
celle qu'on vient d'ajouter.

**9. La recherche d'image la plus proche, bornée.**

*Symptôme* : l'écran se fige pendant que le défilement continue. **Revenir en
arrière débloque**, ce qui oriente vers une mauvaise piste.

*Cause* : `image()` cherchait une voisine jusqu'à douze pas, au-delà rendait
`null`, le rendu gardait la dernière image peinte. Revenir ramenait à moins de
douze images d'une image décodée.

*Correctif* : chercher la plus proche disponible **à n'importe quelle distance**.
Le déficit est structurel — trois crans de molette demandent 75 à 150 images par
seconde, un décodage WebP en produit 30 à 60 — donc on **dégrade** au lieu de
geler.

**10. Les anneaux voisins créés mais jamais alimentés.**

*Symptôme* : l'écran se fige au franchissement d'une frontière de séquence, puis
repart une seconde plus tard.

*Cause* : un anneau alloué est **vide**. Le décodage ne commençait qu'au
franchissement.

*Correctif* : `alimenterVoisins` à **chaque trame** tant que le voisin n'est pas
amorcé, et dans le bon sens — le suivant par son début, le précédent par sa fin.

**11. La fenêtre exprimée en nombre d'images.**

*Symptôme* : une seule séquence saute, et c'est celle où le texte pousse le
visiteur à défiler vite.

*Cause* : cette séquence a 361 images là où les autres en ont 181, sur la même
distance de défilement. À fenêtre égale en images, son tampon en distance était
**moitié moindre**.

*Correctif* : exprimer le tampon en **pixels de défilement** et en déduire le
nombre d'images (§4.2).

**12. Trop de requêtes par trame.**

*Symptôme* : plus on défile vite, plus la page prend du retard, et elle ne le
rattrape jamais même à l'arrêt.

*Cause* : jusqu'à 37 requêtes par trame, soit plus de 2 000 par seconde. Un
navigateur n'ouvre que six connexions par origine : l'image nécessaire
*maintenant* se retrouvait derrière des centaines de requêtes pour des positions
déjà dépassées.

*Correctif* : demander **du plus proche au plus loin**, par paquets bornés
(`paquet = 4`).

**13. Détruire les anneaux au basculement en mode dégradé.**

*Symptôme* : l'image se fige net à partir d'une séquence donnée, et ne revient
jamais.

*Cause* : la bascule du mode dégradé détruisait les anneaux — dont celui qu'on
était en train d'afficher. Et elle survient justement là où la charge de décodage
double.

*Correctif* : `reconfigurer({ taille, pasImage })` change les réglages **sans
jeter le contenu décodé**. L'éviction fait le reste au fil des trames.

### Les raccords

**14. Ne couper le fondu que d'un côté.**

*Symptôme* : on met `fonduEnchaine: 0` sur le segment entrant, et le raccord
reste noir au milieu.

*Cause* : désactiver le fondu d'entrée ne sert à rien si le précédent s'éteint
quand même. **Les deux côtés doivent être traités pour qu'un raccord soit
direct.**

*Correctif* : vérifier les deux séquences. Et se méfier des champs
`fondanteEntree`/`fondanteSortie` de la configuration de Parkside : **ils ne sont
lus par aucun code** (§5.3).

**15. Chercher la bonne image de raccord.**

*Symptôme* : deux clips qui devraient se raccorder sautent visiblement.

*Cause* : les deux clips diffèrent **réellement** — parallaxe, position de caméra.
Une recherche exhaustive 32 × 40 sur la pire jonction n'a gagné que **1 %**
d'écart.

*Correctif* : n'y passez pas la journée. Un fondu enchaîné court le noie ; c'est
le seul remède.

### Le son

**16. Un gain posé en dur qui vaut 1.**

*Symptôme* : la musique d'une salle du milieu du parcours s'entend **à pleine
puissance dès l'arrivée sur le site**.

*Cause* : `gain.value = enLineaire(MUR_DB_DEBUT)` à la construction. Le gain
partait à sa valeur de jeu au lieu de partir de zéro.

*Correctif* : toute piste part à `-60` et ne monte que par `viser`.

**17. Le garde-fou qui compare à une valeur comptable fausse.**

*Symptôme* : l'eau du bassin joue à plein volume dès l'arrivée sur l'écran, et
rien ne la ferme.

*Cause* : deux erreurs qui se couvraient. `banque.viser('eau', 0, 0.1)` mettait le
nœud de gain à **1** (0 dB), et le garde-fou de `suivre` comparait la cible à une
variable comptable partie de **0** — il concluait donc qu'il n'y avait rien à
faire. C'est le même piège que le 16, avec un verrou en plus.

*Correctif* : garer la piste à zéro **franchement**, et faire correspondre la
variable comptable à la réalité.

```js
banque.viserLineaire('eau', 0, 0.01);
let gain = 0;
```

**18. Une piste que rien ne peut plus fermer.**

*Symptôme* : en mode dégradé (donc sans bassin), l'eau reste ouverte.

*Cause* : `eauSuivre` n'était appelé que depuis le rendu du bassin. Sans bassin,
personne ne pouvait plus toucher l'eau, donc personne ne pouvait plus la faire
taire.

*Correctif* : dire `eauSuivre(null)` **à chaque trame** quand le bassin ne rend
pas. Une piste qui ne peut pas se fermer est une piste qui finira ouverte.

**19. L'amorce jouée après le chargement des nappes.**

*Symptôme* : le son du logo arrive plusieurs secondes après le logo.

*Cause* : `await activerSon(...)` avant `jouerAmorce()`. Le chargement et le
décodage des nappes de toutes les scènes prennent plusieurs secondes au premier
passage.

*Correctif* : l'amorce **en tête, non attendue**, et programmée sur l'horloge
audio (§6.6).

### L'eau

**20. Le rendu à l'envers.**

*Symptôme* : la scène entière du bassin s'affiche tête en bas.

*Cause* : la plaque a sa ligne 0 **en haut** (repère image), WebGL met
`uv.y = 0` **en bas**. Toutes les coordonnées relevées à la main — coins,
occultants — sont en repère image.

*Correctif* : retourner **dans le shader de surface, une seule fois**, et non au
téléversement de la texture — retourner les textures obligerait à retourner aussi
toute la configuration.

```glsl
vec2 uvIm = vec2(vUv.x, 1.0 - vUv.y);
```

Ne retournez surtout pas le quad partagé : les passes de simulation lisent et
écrivent avec le même `vUv`, un retournement s'y appliquerait deux fois et
casserait l'échantillonnage des voisins.

**21. Une réfraction qui ne déplace rien.**

*Symptôme* : l'eau bouge « un peu », mais elle reste une photographie. On doute
que la simulation tourne.

*Cause* : `REFRACTION` a été posée à 0,012 à vue. Les pentes de la houle au repos,
mesurées, valent 0,013 à la médiane et 0,075 au maximum. Cela donnait **0,2 pixel
de déplacement médian et 1,1 au maximum** — rien du tout.

*Correctif* : **mesurer la distribution des pentes** puis dimensionner. À 0,07 :
1,2 px à la médiane, 6 au maximum, une quinzaine pour le sillage du doigt.

**22. Un lobe spéculaire qui ne s'allume jamais.**

*Symptôme* : on paie le calcul de l'éclat et l'on ne voit rien.

*Cause* : `OBLIQUITE = 0.18` correspond à 10 degrés — l'inclinaison qu'il faudrait
pour renvoyer le soleil dans l'œil — alors que les pentes de la simulation
**plafonnent à 4 degrés**. La condition n'était jamais atteinte.

*Cause profonde* : la simulation porte la **houle**, pas la **ride capillaire**,
bien plus raide et bien plus fine que la grille de 256 ne peut en représenter.

*Correctif* : `AMPLI_PENTE = 4.0`, qui raidit la normale **pour le seul éclat**.
La réfraction garde la vraie pente : une ride fait scintiller, elle ne déplace pas
le fond du bassin.

**23. La segmentation par couleur du bassin.**

*Symptôme* : le contour part dans le décor.
*Cause* : les reflets spéculaires cassent les plages contiguës.
*Correctif* : repérer à l'œil avec la loupe. Une heure économisée.

**24. Deux tracés à la main n'ont pas le même nombre de sommets.**

*Symptôme* : l'interpolation des occultants entre première et dernière image est
impossible, ou donne n'importe quoi.

*Correctif* : rééchantillonner les deux contours **par longueur d'arc** à un
nombre fixe de sommets avant d'interpoler (§7.5).

**25. L'éditeur qui perd silencieusement un polygone.**

*Symptôme* : on détoure les barres, on exporte, elles ne sont pas là.

*Cause* : un polygone encore ouvert vivait dans une variable de travail, et
l'export ne lisait que la liste des polygones fermés.

*Correctif* : fermer automatiquement à l'export, afficher un **compteur en
direct**, et demander confirmation si la liste est vide.

### La mise en page et l'interface

**26. Un élément ajouté dans une grille lui crée une colonne.**

*Symptôme* : toute la scène se retrouve poussée sur le côté, avec une large bande
noire, image et légende comprises.

*Cause* : `.scene` est une grille qui ne déclare **que des rangées**. Un enfant
placé en `grid-row: N` **sans colonne** est placé automatiquement, et le placement
automatique **refuse de superposer** : il crée une seconde colonne pour le second
élément. Mesuré : `grid-template-columns` valait `876px 563px`.

*Correctif* : déclarer la colonne unique **et** la nommer sur chaque enfant. Les
éléments placés à la main ont le droit de se recouvrir ; l'automatique non.

```css
.scene { display: grid; grid-template-rows: 1fr auto 1fr; grid-template-columns: 1fr; }
#scene, #eau { grid-row: 2; grid-column: 1; }
.faits       { grid-row: 1 / -1; grid-column: 1; align-self: stretch; }
.legende     { grid-row: 3; grid-column: 1; }
```

`align-self: stretch` sur l'écran de fin est nécessaire : `align-items: center` sur
le conteneur l'empêchait de remplir sa hauteur, et l'image restait visible
au-dessus et au-dessous du texte.

**27. `display` qui écrase `hidden`.**

*Symptôme* : les boutons de la porte restent visibles sous le logo pendant toute
l'amorce.

*Cause* : `#porte-choix { display: grid }` gagne sur l'attribut `hidden`.

*Correctif* : ajouter explicitement `#porte-choix[hidden] { display: none; }`.

**28. Le canvas oublié dans le HTML.**

*Symptôme* : le bassin ne s'affiche jamais, et la console lève
`Cannot read properties of null` à chaque trame.

*Cause* : le canvas `#eau` avait sa règle CSS mais **n'existait pas dans le
document**. Le module marchait parfaitement au banc.

*Correctif* : évident une fois trouvé. La leçon est de **vérifier la page
complète**, pas seulement le banc du module.

**29. Un curseur personnalisé illisible sur l'eau.**

*Symptôme* : le curseur « disparaît » sur l'écran du bassin — celui, précisément,
où il est un outil et pas un ornement.

*Cause mesurée* : il ne disparaît pas. Opacité 1, `z-index` 20, aucun mélange. Un
trait de **1 pixel** en blanc cassé à 55 % d'alpha creuse **0,074 de luminance**
sur une eau claire. Sept pour cent : il se noie dans les rides.

*Correctif* : un trait clair **doublé d'un cerne sombre**. Le cerne porte le
contraste sur les fonds clairs, le trait clair sur les fonds sombres, et il y en a
toujours un des deux qui parle.

```css
border: 1px solid rgba(236,233,228,.92);
box-shadow: 0 0 0 1px rgba(0,0,0,.42),
            inset 0 0 0 1px rgba(0,0,0,.30);
```

Pire cas mesuré sur toute la gamme de fonds : **0,074 → 0,290**. Sur l'eau du
bassin : 0,074 → 0,336.

### Chrome sans tête, et ce qu'il ne sait pas faire

Quatre pièges qui font croire à des bugs de code. Ils ont coûté plusieurs heures.

**30. Le contexte WebGL est perdu en travers d'un `await`.** Un contexte pris
avant un `await import(...)` est perdu quand la promesse se résout. Le message
d'erreur qui suit désigne alors la **mauvaise cause** — « extension
indisponible » alors que l'extension est bien là. *Parade* : prendre le contexte
**en dernier**, après tous les `await`.

**31. `createImageBitmap` n'avance pas sous `--virtual-time-budget`.** Le
décodage hors fil ne progresse jamais, la promesse ne se résout pas, et le banc
s'arrête sans message. *Parade* : dans les bancs seulement, charger par `<img>` —
WebGL téléverse l'un comme l'autre.

**32. Le WebGL n'est pas composité.** La capture d'écran donne un canvas **noir**
alors que le dessin n'a produit aucune erreur. Vérifié sur une page WebGL
triviale : c'est l'environnement, pas le code. *Parade* : relire les pixels par
`gl.readPixels` **dans le fil du dessin**, les remettre à l'endroit, et les sortir
en `toDataURL` dans le DOM.

```js
gl.readPixels(0, 0, L, H, gl.RGBA, gl.UNSIGNED_BYTE, lecture);
for (let y = 0; y < H; y++) {
  img.data.set(lecture.subarray((H-1-y)*L*4, (H-y)*L*4), y*L*4);
}
```

**33. Une transition CSS lue sous temps virtuel rend sa valeur de départ.**
L'horloge des animations n'avance pas : on lit `opacity: 0` sur un élément
visible, et l'on conclut à tort qu'il est caché. *Parade* :
`element.style.transition = 'none'` avant de mesurer.

### Une dernière, de méthode

**34. Écrire du JavaScript par substitution de chaînes depuis un autre langage.**
Trois fichiers cassés sur Parkside par des `\n` interprétés à l'intérieur de
chaînes JS, plus une apostrophe non échappée dans un `heredoc`. *Parade* : écrire
les fichiers contenant du JS avec un outil d'écriture de fichier, jamais par
substitution.

---

## 10. Les chiffres mesurés

Ce sont des **mesures**, pas des objectifs. Elles vous donnent l'ordre de
grandeur à viser et les seuils au-delà desquels quelque chose casse.

### 10.1 Poids livré

Mesuré sur le disque au moment d'écrire ce document, 2 412 images
(12 clips : dix à 181 images, un à 361, un à 241).

| Jeu | Images | Audio | Total | ko par image |
|---|---|---|---|---|
| bureau, 1280 | 223,99 Mo | 29,05 Mo | **253,04 Mo** | 95,1 |
| mobile, 854 | 127,77 Mo | 29,05 Mo | **156,82 Mo** | 54,2 |

Le jeu mobile pèse **57 % du bureau**, alors que sa surface n'en fait que 44 % :
le WebP ne suit pas le compte de pixels, une petite image coûte plus cher au
pixel. La mémoire et le décodage, eux, suivent bien la surface.

Détail par séquence, jeu bureau — utile pour repérer ce qui coûte :

| Séquence | Images | 1280 | 854 |
|---|---|---|---|
| `01-facade` | 181 | 34,80 Mo | 19,28 Mo |
| `02-seuil` | 181 | 13,45 Mo | 8,37 Mo |
| `03-comptoir` | 181 | 24,31 Mo | 13,19 Mo |
| `04-spa` | 181 | 9,49 Mo | 5,79 Mo |
| `05-velos` | 361 | 21,83 Mo | 12,60 Mo |
| `06a-salle-sport` | 181 | 8,43 Mo | 5,00 Mo |
| `06b-mur-yoga` | 181 | 7,10 Mo | 4,36 Mo |
| `07-appartement` | 181 | 19,36 Mo | 11,10 Mo |
| `08-traversee-chambre` | 181 | 3,84 Mo | 2,24 Mo |
| `09a-bar` | 181 | 25,38 Mo | 14,90 Mo |
| `09b-bar` | 181 | 9,09 Mo | 5,51 Mo |
| `10-toit` | 241 | 46,93 Mo | 25,42 Mo |

Le rapport entre la plus lourde et la plus légère est de **neuf**, à qualité et
nombre d'images comparables. C'est le contenu de l'image qui décide, pas le
réglage.

**Cible et plafond**, pour situer : un parcours complet ne doit pas coûter plus
cher qu'une vidéo équivalente. Quatre minutes de 1080p à 5 Mbit/s font environ
150 Mo — c'est la cible, et 250 Mo le plafond absolu. Le jeu bureau est **à la
limite haute**, assumé après avoir jugé la netteté à l'œil sur les planches à
100 % ; le jeu mobile est confortablement sous la cible.

### 10.2 Débit nécessaire

Ce n'est pas une facture, c'est un **plancher**. Le chargement doit tenir une
séquence d'avance, soit environ 20 s de visite.

| Jeu | Débit requis | En dessous |
|---|---|---|
| bureau, 1280 | **7,4 Mbit/s** | le visiteur dépasse le chargeur, la page devient un diaporama |
| mobile, 854 | **4,2 Mbit/s** | idem |

Une séquence WebP pèse environ 8,75 Mo, contre 5,25 en AVIF : ces 42 Mo d'écart
sur l'ensemble sont **le prix payé pour la marge de décodage** (§2.6). L'AVIF
tenait jusqu'à 2,1 Mbit/s.

### 10.3 Mémoire

| | Décodée | Anneau de 40 | Plafond de 90 |
|---|---|---|---|
| 1280 × 720 | **3,52 Mio** | 141 Mio | 317 Mio |
| 854 × 480 | **1,56 Mio** | 63 Mio | 141 Mio |

Une séquence entière décodée ferait **637 Mio** en 1280. Le banc a tenu 400
images retenues sur iPad sans recyclage de l'onglet, soit dix fois `RING_SIZE`.

### 10.4 Format, à qualité appariée

| Point | SSIM | ko/image | Total images | Réencodage des 2 412 |
|---|---|---|---|---|
| AVIF crf 32 | 0,969 | 26,9 | 63 Mo | 26 min |
| WebP q 60 | 0,968 | 44,6 | 105 Mo | 4 min |

### 10.5 Réseau local, et le piège du serveur

| Chemin | Temps par requête |
|---|---|
| `http://localhost:8000/` sur un serveur IPv4 seul | **2040 ms** |
| `http://127.0.0.1:8000/` sur le même serveur | **1,2 ms** |
| `http://localhost:8000/` sur un serveur double pile | 1,2 ms |

### 10.6 L'eau

Pentes de la houle au repos, relevées sur le banc dans le quadrilatère :

| | Pente | Déplacement à `REFRACTION` 0,012 | à 0,07 |
|---|---|---|---|
| médiane | 0,0131 | 0,20 px | 1,17 px |
| centile 90 | 0,0288 | 0,44 px | 2,58 px |
| centile 99 | 0,0549 | 0,84 px | 4,92 px |
| maximum | 0,0745 | 1,14 px | 6,67 px |

Mouvement réellement produit, deux rendus séparés de 6 pas de simulation,
différence moyenne des pixels dans le bassin :

| | moyenne | centile 99 | maximum |
|---|---|---|---|
| `REFRACTION = 0,012` (4 pas) | 1,74 | 11,7 | 35 |
| `REFRACTION = 0,07` (6 pas) | **6,62** | **52,0** | **107** |

Étanchéité du rendu, écart à la plaque d'origine :

| Zone | Écart moyen | Centile 99 |
|---|---|---|
| **hors** du bassin et sur les occultants | 1,2 à 1,4 | 5,0 |
| dans le bassin | 3,0 à 5,2 | 17 à 43 |

Les 1,2 hors bassin sont le **plancher de bruit du JPEG de relecture** du banc :
le rendu est identique à la plaque partout où il doit l'être.

Homographie, quatre coins renvoyés sur le carré unité, pire erreur sur sept
valeurs de `t` : **1,78 × 10⁻¹⁵**.

Miroitement mesuré sur les 241 images du toit : chaleur maximale à l'**image
100** (`t = 0,412`), sous 5 % à l'**image 160**. L'étendue du miroitement se
resserre à **0,087** vers `t = 0,29`, quand le disque solaire est net et bas.
Les projecteurs immergés prennent le relais de `t = 0,52` à `t = 0,83`.

### 10.7 Interface

Contraste du curseur, écart de luminance avec le fond, sur toute la gamme :

| Fond | 0,0 | 0,2 | 0,4 | 0,6 | 0,8 | 1,0 |
|---|---|---|---|---|---|---|
| avant | — | — | — | — | **0,074** | — |
| après | 0,842 | 0,658 | 0,474 | **0,290** | 0,336 | 0,420 |

Le pire cas est à 0,290, au croisement des deux traits. Critère retenu : **≥ 0,20
sur tous les fonds**.

### 10.8 Longueur du parcours

| | |
|---|---|
| Segments | 12 clips + 1 écran de faits |
| Hauteurs d'écran, total | **87** |
| À 900 px de haut | 78 300 px de défilement |
| Durée visée | environ quatre minutes du premier au dernier écran |

### 10.9 Ce qui n'a PAS été mesuré

Je le signale plutôt que de donner un chiffre plausible.

- **Le LCP et le temps de premier écran interactif.** Les seuils visés sont
  LCP < 2,5 s en 4G simulée et premier écran interactif < 3 s, mais **aucune
  mesure Lighthouse n'a été faite** sur Parkside.
- **Les images par seconde sur matériel réel.** Le plancher visé est 60 constantes
  sur un MacBook Air M1 et 30 sur un iPhone 12. Le coût par trame du bassin
  WebGL **n'a jamais été mesuré sur du vrai matériel** : les temps relevés sous
  swiftshader sans tête ne veulent rien dire.
- **Le poids du JS de première charge.** Le budget est de 250 ko compressés ;
  le total des sources est de 4 834 lignes de JS non compressé, ce qui laisse
  une marge confortable, mais le chiffre exact après compression n'a pas été
  relevé.

**Faites ces trois mesures le premier jour** sur le nouveau site, pas le dernier.

---

## 11. L'ordre de travail, pour trois jours

L'erreur qui tuerait le projet serait de monter douze séquences à moitié.
**Construisez une séquence entière avant douze séquences partielles.**

Choisissez comme première celle qui contient le plus de mécanismes à la fois — un
travelling scrubbé, un changement de lumière, un scellement sonore, un son
déclenché à l'unité et un texte qui arrive au bon moment. Quand elle marche, tout
le reste est de la répétition.

### Jour 1 — la machine

1. Copier `serve.py`, `frames.sh`, `encode.sh`, `build-frames.sh`. **Lancer le
   serveur et vérifier qu'une requête via `localhost` prend une milliseconde et
   non deux secondes** (§9 piège 1). Cinq minutes, et ça vous évite la journée
   perdue.
2. Extraire et encoder **un seul clip**, en deux jeux, pour valider la chaîne.
3. Copier le squelette : `index.html` avec sa grille (§9 piège 26), `main.js`,
   `smooth-scroll.js`, `sequence-map.js`, `frame-source.js`, `frame-ring.js`,
   `prefetch.js`, `frame-renderer.js`, `constants.js`.
4. Faire défiler ce clip. **Ne touchez à aucune constante de ressenti.**
5. Les trois mesures de la §10.9 : Lighthouse, images par seconde sur un vrai
   téléphone, poids du JS compressé.

### Jour 2 — le contenu

6. Encoder les onze autres clips. Pendant l'encodage, écrire `sequences.js`.
7. Brancher le son : `graph.js`, `tracks.js`, `scene.js`, `seal.js`,
   `one-shots.js`, puis les couches scène par scène.
8. Régler les raccords (§5.3). C'est là que se joue la différence entre un
   montage et une succession de plans.
9. La porte et l'amorce. **Vérifiez tout de suite que le son du logo tombe sur la
   première image du logo** (§6.6).
10. Le mode dégradé, et `prefers-reduced-motion`. **Le brief d'origine exigeait
    qu'ils soient finis avant la fin du jour trois** — ils se construisent avec le
    moteur, pas après, et il faut les forcer tous les jours pour les voir.

### Jour 3 — l'eau, et la finition

11. Le calage : l'outil de la §8, les repères, les occultants. **Rendez-vous une
    image fixe avec le quadrilatère et le masque tracés, en fausses couleurs,
    avant d'écrire une ligne de simulation.**
12. La simulation, copiée telle quelle, testée seule.
13. Le calage sur la plaque, puis le son de l'eau, puis les gouttes ambiantes.
14. L'écran de fin, les métadonnées, l'image de partage, le JSON-LD.
15. Déploiement. **Vérifiez `.vercelignore`** : sans lui, les documents de travail
    internes — prix, relation commerciale — partent sur le domaine du client.

### Ce qu'il faut refuser

Repris du brief d'origine, et toujours valable :

- **Aucun préchargeur avec pourcentage.** L'écran d'entrée est le préchargeur.
- **Aucun scroll-jacking dur.** Le défilement par cran d'écran entier est interdit.
- **Aucun son qui démarre sans clic explicite**, et la bascule reste accessible en
  permanence.
- **Aucune bibliothèque d'interface**, aucun kit d'animation, aucun framework de
  composants. Ce site n'a qu'une page.
- **Aucun emoji**, nulle part, ni dans le code ni dans l'interface.
- **Rien qui ne soit pas dans le document de séquence.** Si une idée n'y est pas,
  elle se propose avant d'être codée.

Et deux règles d'accessibilité qui ne sont pas négociables : **tout texte à
l'écran doit exister dans le DOM**, lisible par un lecteur d'écran même quand il
est peint par-dessus une image ; et **le site en mouvement réduit doit rester
beau** — c'est une version, pas une punition.

---

## Ce que ce document ne contient pas

Par honnêteté sur ses limites :

- Le **contenu** de Parkside — textes, séquences, niveaux sonores — n'y est
  reproduit que comme exemple de forme. Rien n'y est transposable tel quel.
- Le **mode dégradé** et `prefers-reduced-motion` sont décrits par leurs
  constantes et leurs déclencheurs, mais leur implémentation complète est dans
  `src/quality/degraded.js` et dans `modeFixe()` de `main.js`, qui ne sont pas
  reproduits ici. Sur Parkside, le mouvement réduit n'affiche **que la première
  séquence** en image fixe : c'est un raccourci, pas un modèle à copier.
- Trois des quatre **comportements sonores propres** de Parkside — filtre piloté
  par la vitesse, pente sur trois salles, rideau — ne sont décrits que par leur
  forme d'interface. Ils sont du contenu. Le quatrième, la traversée de vitre,
  est reproduit intégralement en §6.7 : il se répète dès que la caméra sort du
  bâtiment, ce qui en fait de la machine.
- Le coût par trame du bassin WebGL **n'a jamais été mesuré sur du vrai
  matériel** (§10.9).

Tout ce qui est cité comme constante, chemin ou mesure a été copié du code ou du
disque au moment de la rédaction. Là où une valeur manquait, c'est écrit.
