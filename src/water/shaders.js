// Les shaders du bassin.
//
// LES QUATRE PREMIERS SONT COPIES VERBATIM de l'autre projet
// (src/components/gl/materiaux/bassin.ts), qui les tient lui-meme d'une source
// WGSL traduite a la ligne pres. Ils ne sont ni reecrits, ni « ameliores », ni
// retapes de memoire : la decroissance en cosinus de la goutte, les trois
// lignes de l'onde et la normale dans les canaux `ba` sont exactement celles
// qui ont ete reglees la-bas.
//
// UNE SEULE ADAPTATION, et elle est mecanique : la source tourne sous three.js,
// qui injecte lui-meme `position`, `uv`, `projectionMatrix` et `modelViewMatrix`
// dans chaque shader. Ici il n'y a pas de three.js -- le budget de 250 ko de JS
// ne le permet pas pour un seul ecran -- donc ces declarations sont ecrites a
// la main. Le CORPS des fonctions est intact.
//
// Le cinquieme, en revanche, est ECRIT et non copie. La-bas il dessine une eau ;
// ici il doit deformer une photographie.

/** Le plan plein cadre des passes de simulation. */
export const SOMMET_PLEIN_CADRE = `
  attribute vec3 position;
  attribute vec2 uv;
  uniform mat4 projectionMatrix;
  uniform mat4 modelViewMatrix;

  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** `shaders/water/drop.frag.wgsl`. Decroissance en cosinus, pas un gaussien. */
export const FRAGMENT_GOUTTE = `
  precision highp float;
  uniform sampler2D uEtat;
  uniform vec2 uCentre;
  uniform float uRayon;
  uniform float uForce;
  varying vec2 vUv;

  void main() {
    vec4 info = texture2D(uEtat, vUv);
    float goutte = max(0.0, 1.0 - length(uCentre * 0.5 + 0.5 - vUv) / uRayon);
    goutte = 0.5 - cos(goutte * 3.14159265) * 0.5;
    info.r += goutte * uForce;
    gl_FragColor = info;
  }
`;

/** `shaders/water/update.frag.wgsl`. Le pas de simulation, a la ligne pres. */
export const FRAGMENT_SIMULATION = `
  precision highp float;
  uniform sampler2D uEtat;
  uniform vec2 uTexel;
  varying vec2 vUv;

  void main() {
    vec4 info = texture2D(uEtat, vUv);

    vec2 dx = vec2(uTexel.x, 0.0);
    vec2 dy = vec2(0.0, uTexel.y);

    float moyenne = (
      texture2D(uEtat, vUv - dx).r +
      texture2D(uEtat, vUv - dy).r +
      texture2D(uEtat, vUv + dx).r +
      texture2D(uEtat, vUv + dy).r
    ) * 0.25;

    /* La vitesse gagne l'ecart a la moyenne des voisins, perd un demi-pour-cent
       par pas, et la hauteur l'integre. Trois lignes, et c'est toute l'onde. */
    info.g += (moyenne - info.r) * 2.0;
    info.g *= 0.995;
    info.r += info.g;

    gl_FragColor = info;
  }
`;

/** `shaders/water/normal.frag.wgsl`. La normale dans les canaux `ba`. */
export const FRAGMENT_NORMALE = `
  precision highp float;
  uniform sampler2D uEtat;
  uniform vec2 uTexel;
  varying vec2 vUv;

  void main() {
    vec4 info = texture2D(uEtat, vUv);

    float hx = texture2D(uEtat, vec2(vUv.x + uTexel.x, vUv.y)).r;
    float hy = texture2D(uEtat, vec2(vUv.x, vUv.y + uTexel.y)).r;

    vec3 dx = vec3(uTexel.x, hx - info.r, 0.0);
    vec3 dy = vec3(0.0, hy - info.r, uTexel.y);

    vec3 normale = normalize(cross(dy, dx));
    info.b = normale.x;
    info.a = normale.z;

    gl_FragColor = info;
  }
`;

/**
 * LA SURFACE — ecrite, et non copiee.
 *
 * La-bas, ce shader invente une eau : sa couleur, sa transparence, ses reflets,
 * ses caustiques. Ici tout cela est DEJA dans la photographie, et juste :
 * le fond du bassin, les parois, les caustiques du soleil sur le carrelage, la
 * couleur de l'eau a chaque heure du jour. Les simuler les doublerait.
 *
 * Ce shader ne fait donc que deux choses.
 *
 * 1. Il decale l'echantillonnage de la plaque par la normale de la simulation.
 *    L'image se met a onduler sans qu'on ait rien invente : c'est la
 *    photographie elle-meme qui bouge, donc elle reste juste a toute heure.
 *
 * 2. Il ajoute un eclat speculaire calcule sur la meme normale, pour les
 *    scintillements que le decalage seul ne produit pas -- une refraction
 *    deplace, elle n'allume pas.
 *
 * DEUX TERMES DE NATURE DIFFERENTE, et c'est cette difference qui empeche
 * l'eau de mourir quand la nuit tombe. Une eau simplement assombrie a l'air
 * morte : la nuit, elle ne perd pas son eclat, elle en CHANGE.
 *
 *   le soleil        un chemin, une direction, un lobe dur. Une facette
 *                    n'allume que si elle est sur le chemin, ce qui donne une
 *                    trainee et non un vernis uniforme.
 *   les projecteurs  ni chemin ni direction : une lumiere qui vient d'en
 *                    dessous scintille partout a la fois.
 *
 * SUR CE PLAN-CI, LE TERME SOLAIRE EST ETEINT. La mesure est nette : a
 * l'interieur du quadrilatere, l'eau ne porte aucune trainee chaude a aucun
 * instant du plan -- le soleil est hors cadre, bas et a gauche, et l'eau ne
 * reflete que la vegetation et le ciel. `ECLAT_SOLEIL` vaut donc zero partout
 * et `uSoleil` arrive nul : le terme s'annule de lui-meme, sans qu'il faille
 * toucher au shader. Le code des deux termes reste en place, pret pour un plan
 * qui aurait un soleil visible.
 *
 * `uMasque` porte les occultants -- ce qui est DEVANT la surface et doit etre
 * redessine par-dessus l'onde. La ou il vaut un, on relit la plaque SANS
 * decalage. On echantillonne l'image COURANTE et non une image figee, sinon
 * leur lumiere cesserait de suivre la tombee du jour. Ici le masque est vide :
 * rien ne traverse la ligne d'eau sur ce plan.
 */
export const FRAGMENT_SURFACE = `
  precision highp float;

  uniform sampler2D uPlaque;    // l'image de la sequence, a cette trame
  uniform sampler2D uEtat;      // l'etat de la simulation, normale en .ba
  uniform sampler2D uMasque;    // les occultants, en rouge
  uniform mat3 uVersUnite;      // homographie inverse : plaque -> carre unite
  uniform float uRefraction;    // amplitude du decalage, en unites d'UV

  uniform vec2 uMiroir;         // centre mesure du miroitement, carre unite
  uniform vec2 uEtendue;        // etendue mesuree du miroitement
  uniform vec2 uPencher;        // inclinaison de la normale exigee, azimut du soleil
  uniform float uDurete;        // durete du lobe speculaire
  uniform float uAmpli;         // raidissement de la normale, pour le seul eclat
  uniform vec3 uSoleil;         // teinte du soleil, deja multipliee par sa force
  uniform vec3 uNuit;           // teinte des projecteurs, idem
  uniform float uFausses;       // 1 : fausses couleurs de recette

  varying vec2 vUv;

  const float FRESNEL_MIN = 0.25;

  void main() {
    /* WebGL met l'origine des UV en BAS a gauche ; la plaque, le masque et
       toutes les coordonnees relevees a la main (coins du bassin, contours des
       occultants) sont en repere image, origine EN HAUT a gauche. On retourne
       ici, une seule fois, plutot que de retourner les textures au televersement
       -- ce qui obligerait a retourner aussi tout ce qui est dans la config. */
    vec2 uvIm = vec2(vUv.x, 1.0 - vUv.y);

    // Le carre unite de la simulation, vu depuis ce pixel de la plaque.
    vec3 h = uVersUnite * vec3(uvIm, 1.0);
    vec2 unite = h.xy / h.z;

    float masque = texture2D(uMasque, uvIm).r;
    bool dansBassin = unite.x > 0.0 && unite.x < 1.0
                   && unite.y > 0.0 && unite.y < 1.0;

    if (!dansBassin || masque > 0.5) {
      /* Hors du bassin, ou derriere un occultant : la plaque, intacte. */
      vec4 p = texture2D(uPlaque, uvIm);
      /* En fausses couleurs on assombrit tout de meme le hors-bassin, pour que
         le quadrilatere et les occultants se lisent d'un coup d'oeil. */
      gl_FragColor = vec4(mix(p.rgb, p.rgb * 0.25 + vec3(0.0, 0.0, 0.12 * masque),
                              uFausses), 1.0);
      return;
    }

    vec4 info = texture2D(uEtat, unite);
    vec3 normale = vec3(info.b, sqrt(max(0.0, 1.0 - dot(info.ba, info.ba))), info.a);

    /* Le decalage. On adoucit pres des bords du bassin : une onde qui pousse
       l'echantillonnage au-dela du quadrilatere irait chercher du carrelage
       sec et le ferait onduler. */
    vec2 bord = min(unite, 1.0 - unite);
    float marge = smoothstep(0.0, 0.06, min(bord.x, bord.y));
    vec2 decalage = normale.xz * uRefraction * marge;
    vec3 couleur = texture2D(uPlaque, uvIm + decalage).rgb;

    /* La ride, que la simulation ne porte pas : une normale raidie, qui ne sert
       qu'a l'eclat. La refraction, elle, garde la vraie pente -- une ride
       capillaire fait scintiller, elle ne deplace pas le fond du bassin. */
    vec3 ridee = normalize(vec3(info.b * uAmpli, 1.0, info.a * uAmpli));

    /* Fresnel de Schlick, plancher a FRESNEL_MIN : une eau vue de biais
       reflete toujours un peu, meme la ou la normale est plate. */
    vec3 versOeil = normalize(vec3(0.0, 1.0, 0.35));
    float fresnel = FRESNEL_MIN
                  + (1.0 - FRESNEL_MIN) * pow(1.0 - max(0.0, dot(ridee, versOeil)), 5.0);

    /* LE CHEMIN DU SOLEIL, tel qu'il est mesure sur la plaque. Une facette
       n'allume que si elle est dessus : c'est ce qui donne une trainee et non
       un vernis uniforme sur tout le bassin. */
    vec2 ecart = (unite - uMiroir) / uEtendue;
    float chemin = exp(-dot(ecart, ecart));

    /* La normale qu'il faudrait, au centre du chemin, pour renvoyer le soleil
       dans l'oeil : verticale, penchee dans son azimut. Ce sont donc les
       facettes tournees VERS le soleil qui s'allument, et pas les autres. */
    vec3 exigee = normalize(vec3(uPencher.x, 1.0, uPencher.y));
    float lobe = pow(max(0.0, dot(ridee, exigee)), uDurete);

    /* Les projecteurs immerges eclairent par en dessous : leur eclat n'a ni
       chemin ni direction, il prend n'importe quelle facette un peu inclinee. */
    float pente = clamp(length(ridee.xz) * 3.0, 0.0, 1.0);

    couleur += uSoleil * lobe * chemin * fresnel
             + uNuit * pente * pente * fresnel;

    /* Recette : la hauteur en rouge et bleu, la pente en vert, le chemin du
       soleil en surimpression. Rien de tout cela n'est visible en production. */
    vec3 faux = vec3(max(info.r, 0.0) * 8.0, pente, max(-info.r, 0.0) * 8.0)
              + vec3(0.35, 0.30, 0.0) * chemin;
    gl_FragColor = vec4(mix(couleur, faux, uFausses), 1.0);
  }
`;
