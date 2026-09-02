// Le calage du bassin sur la plaque — sequence treize, la piscine du toit.
//
// Releve a la main dans tools/editeur-bassin.html, a la loupe, sur les images
// reelles. Ces valeurs ne se devinent pas depuis le code : elles decrivent ou
// se trouve la surface libre dans une photographie, et seul l'oeil le sait.
//
// Deux differences avec le bassin de Parkside, qui valent d'etre notees pour
// qui reprendra le fichier :
//
//   - le quadrilatere est ENTIEREMENT dans le cadre. Celui de Parkside avait
//     deux coins hors champ et sa ligne d'eau proche traversait toute l'image ;
//     ici les quatre coins sont visibles et se posent directement.
//   - le plan n'est pas fixe, et il ne derive pas non plus : il ZOOME EN
//     ARRIERE. Mesure par correlation de phase, la translation globale est
//     nulle d'un bout a l'autre du plan (cumul de 5 px sur 133 images) ; mais
//     les quatre coins se rapprochent tous du centre de l'image, d'un facteur
//     0,894 a 0,955 selon le coin. C'est un mouvement d'echelle, pas de
//     position, et c'est exactement ce qu'une homographie a repere unique ne
//     saurait pas suivre : l'ecart atteindrait une quarantaine de pixels au
//     coin le plus eloigne en fin de plan.

/**
 * Les reperes de calage, tries par `t` croissant — `versUniteN` le suppose.
 *
 * `t` est l'index d'image NORMALISE, (index - 1) / (nbImages - 1), et non la
 * progression du defilement. Les deux ne coincident pas sur un segment qui
 * porte une `miseEnRoute`, dont la progression suit une loi en carre au
 * depart : les reperes sont poses sur des images, ils doivent etre relus sur
 * des images.
 *
 * Deux reperes suffisent ici parce que le zoom est regulier. Le systeme en
 * accepte davantage : il suffit d'inserer une ligne dans l'ordre des `t`, sans
 * rien reecrire, si l'on constate un decollement a mi-plan.
 */
export const BASSIN_REPERES = [
  { t: 0.000, coins: { HG: [195, 457], HD: [772, 333], BD: [1062, 365], BG: [565, 588] } },
  { t: 1.000, coins: { HG: [214, 450], HD: [767, 346], BD: [1040, 371], BG: [570, 563] } },
];

/**
 * Les occultants : ce qui est DEVANT la surface et doit etre redessine
 * par-dessus l'eau.
 *
 * VIDE, et c'est un constat, pas un oubli. Rien ne traverse la ligne d'eau sur
 * ce plan : pas d'echelle, pas de barre metallique, pas de mobilier qui plonge.
 * Les bains de soleil et la margelle sont entierement HORS du quadrilatere, et
 * l'eau n'est jamais dessinee hors du quadrilatere -- ils n'ont donc besoin
 * d'aucun masque. La regle est de ne detourer que ce qui TRAVERSE la ligne
 * d'eau ; ici, rien.
 *
 * Si un occultant devait etre ajoute, il se releve en mode masque de l'editeur
 * et se colle ici. Le rechantillonnage ci-dessous l'attend deja.
 */
export const BASSIN_OCCULTANTS = [];

/**
 * Le decalage du masque sur la DERNIERE image, en pixels.
 *
 * Les occultants suivent le mouvement de la camera ; on ne les retrace pas a
 * la fin, on les translate. Nul ici, puisqu'il n'y a pas d'occultant.
 */
export const BASSIN_OCCULTANTS_FIN = [0, 0];

/**
 * Rechantillonne un contour a `n` sommets, par LONGUEUR D'ARC.
 *
 * De la machine, copiee telle quelle. Elle sert des qu'un occultant est releve
 * deux fois -- sur la premiere et sur la derniere image -- parce que deux
 * traces a la main n'ont jamais le meme nombre de sommets (15 puis 18, 20 puis
 * 19 sur Parkside) et que l'interpolation sommet a sommet est alors
 * impossible. Apres rechantillonnage a un nombre fixe, les points se
 * correspondent.
 */
function reechantillonner(contour, n) {
  const pts = contour.slice();
  if (pts[0][0] !== pts[pts.length - 1][0] || pts[0][1] !== pts[pts.length - 1][1]) {
    pts.push(pts[0]);
  }
  const longueurs = [0];
  for (let k = 1; k < pts.length; k++) {
    longueurs.push(longueurs[k - 1] +
      Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
  }
  const total = longueurs[longueurs.length - 1];
  const sortie = [];
  for (let k = 0; k < n; k++) {
    const cible = (total * k) / n;
    let j = 1;
    while (j < longueurs.length - 1 && longueurs[j] < cible) j++;
    const t = (cible - longueurs[j - 1]) / (longueurs[j] - longueurs[j - 1] || 1);
    sortie.push([
      pts[j - 1][0] + (pts[j][0] - pts[j - 1][0]) * t,
      pts[j - 1][1] + (pts[j][1] - pts[j - 1][1]) * t,
    ]);
  }
  return sortie;
}

/** Sommets par contour apres rechantillonnage. Large : ils sont fins. */
const SOMMETS = 48;

const OCC = BASSIN_OCCULTANTS.map((c) => reechantillonner(c, SOMMETS));

/**
 * Les occultants a la progression `t`, en pixels de la plaque.
 *
 * On les redessine en echantillonnant l'IMAGE COURANTE et non une image figee,
 * sinon leur lumiere cesserait de suivre la tombee du jour -- alors que toute
 * la sequence est un coucher de soleil suivi d'une nuit.
 *
 * @param {number} t progression dans la sequence, de 0 a 1
 */
export function occultantsA(t) {
  const [ox, oy] = BASSIN_OCCULTANTS_FIN;
  return OCC.map((contour) =>
    contour.map(([x, y]) => [x + ox * t, y + oy * t]));
}
