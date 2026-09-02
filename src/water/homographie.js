// L'homographie carre unite -> quadrilatere, et son inverse.
//
// Quatre correspondances suffisent et sont EXACTES : il n'y a ni camera 3D a
// poser, ni pose a resoudre, ni iteration a faire converger. On sait ou sont
// les quatre coins du bassin dans la plaque, on sait qu'ils correspondent aux
// quatre coins du carre unite de la simulation, et cela determine la matrice.
//
// Le cas carre-vers-quadrilatere a une forme fermee, donnee par Heckbert dans
// « Fundamentals of Texture Mapping and Image Warping ». On l'ecrit telle
// quelle plutot que de monter une resolution generale a huit inconnues.

/**
 * Matrice 3x3 envoyant (0,0) (1,0) (1,1) (0,1) sur les quatre points donnes.
 *
 * @param {number[]} p0 image de (0,0)
 * @param {number[]} p1 image de (1,0)
 * @param {number[]} p2 image de (1,1)
 * @param {number[]} p3 image de (0,1)
 * @returns {number[]} la matrice, en colonnes, prete pour uniformMatrix3fv
 */
export function carreVers(p0, p1, p2, p3) {
  const dx1 = p1[0] - p2[0], dx2 = p3[0] - p2[0];
  const dy1 = p1[1] - p2[1], dy2 = p3[1] - p2[1];
  const sx = p0[0] - p1[0] + p2[0] - p3[0];
  const sy = p0[1] - p1[1] + p2[1] - p3[1];

  let g, h;
  const det = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(det) < 1e-12) {
    // Les quatre points forment un parallelogramme : pas de fuite, donc pas de
    // terme projectif. Ce n'est pas notre cas ici -- le bassin est vu en
    // perspective -- mais le cas degenere doit rester sain.
    g = 0; h = 0;
  } else {
    g = (sx * dy2 - dx2 * sy) / det;
    h = (dx1 * sy - sx * dy1) / det;
  }

  const a = p1[0] - p0[0] + g * p1[0];
  const b = p3[0] - p0[0] + h * p3[0];
  const c = p0[0];
  const d = p1[1] - p0[1] + g * p1[1];
  const e = p3[1] - p0[1] + h * p3[1];
  const f = p0[1];

  // En COLONNES : c'est ce que veut uniformMatrix3fv sans transposition.
  return [a, d, g, b, e, h, c, f, 1];
}

/** Inverse d'une 3x3 donnee en colonnes. */
export function inverser(m) {
  const [a, d, g, b, e, h, c, f, i] = m;
  const A =  (e * i - h * f), B = -(b * i - h * c), C =  (b * f - e * c);
  const D = -(d * i - g * f), E =  (a * i - g * c), F = -(a * f - d * c);
  const G =  (d * h - g * e), H = -(a * h - g * b), I =  (a * e - d * b);
  const det = a * A + b * D + c * G;
  if (Math.abs(det) < 1e-12) throw new Error('homographie non inversible');
  const k = 1 / det;
  return [A * k, D * k, G * k, B * k, E * k, H * k, C * k, F * k, I * k];
}

/**
 * L'homographie de la plaque VERS le carre unite, a la progression `t`.
 *
 * Difference avec Parkside, ou le plan etait quasiment fixe : ici le bassin
 * DERIVE pendant le plan. Deux coins figes produiraient une eau qui se decale
 * de l'image -- imperceptiblement d'abord, puis franchement au bord le plus
 * eloigne, parce que c'est la que la perspective amplifie le moindre ecart
 * angulaire.
 *
 * `reperes` est une liste triee par `t` croissant :
 *
 *   [ { t: 0,    coins: { HG:[x,y], HD:[x,y], BD:[x,y], BG:[x,y] } },
 *     { t: 0.5,  coins: { ... } },          // facultatif, si la derive n'est
 *     { t: 1,    coins: { ... } } ]         // pas reguliere
 *
 * On interpole les QUATRE POINTS de proche en proche, puis on construit la
 * matrice a partir des points interpoles. On n'interpole JAMAIS la matrice
 * elle-meme : une moyenne de deux homographies n'est pas l'homographie de la
 * moyenne des points, et la difference se voit au bord le plus lointain.
 *
 * Le `t` attendu ici est l'index d'image normalise -- (index - 1) / (n - 1) --
 * et non la progression du defilement. Les deux ne coincident pas sur un
 * segment qui porte une `miseEnRoute`, dont la progression suit une loi en
 * carre au depart, alors que les reperes sont poses sur des index d'image.
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
