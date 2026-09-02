// Banc de l'homographie a N reperes.
//
// A ecrire et a faire passer AVANT de brancher quoi que ce soit sur le shader :
// une erreur de calage se voit a l'ecran comme une eau qui deborde du bassin,
// et l'on cherche alors dans le shader ce qui est dans la matrice.
//
// Le critere est le premier chiffre : a n'importe quel `t`, les quatre coins
// interpoles doivent retomber sur (0,0) (1,0) (1,1) (0,1) a la precision
// machine. La reference de la passation est 1.78e-15.
//
//   node tools/recette-homographie.mjs

import { carreVers, inverser, versUniteN } from '../src/water/homographie.js';

const L = 1280, H = 720;
let echecs = 0;

const verifier = (nom, valeur, seuil) => {
  const ok = valeur <= seuil;
  if (!ok) echecs++;
  const v = typeof valeur === 'number' ? valeur.toExponential(2) : valeur;
  console.log(`  ${ok ? 'ok  ' : 'ECHEC'} ${nom.padEnd(46)} ${v.padStart(10)}  (seuil ${seuil.toExponential(0)})`);
};

/** Applique une matrice donnee en COLONNES a un point, et deshomogeneise. */
function appliquer(m, p) {
  const [a, d, g, b, e, h, c, f, i] = m;
  const x = a * p[0] + b * p[1] + c;
  const y = d * p[0] + e * p[1] + f;
  const w = g * p[0] + h * p[1] + i;
  return [x / w, y / w];
}

// Des reperes qui derivent franchement, pour que le test morde : le bassin
// glisse et se resserre, comme celui de Noverre est cense le faire.
const REPERES = [
  { t: 0.0, coins: { HG: [498, 400], HD: [760, 400], BD: [1279, 610], BG: [0, 611] } },
  { t: 0.5, coins: { HG: [470, 392], HD: [742, 390], BD: [1262, 600], BG: [12, 604] } },
  { t: 1.0, coins: { HG: [430, 381], HD: [715, 377], BD: [1240, 588], BG: [30, 595] } },
];

const CIBLES = { HG: [0, 0], HD: [1, 0], BD: [1, 1], BG: [0, 1] };

// --- 1. Les quatre coins retombent sur le carre unite, a tout t -------------
console.log('\n1. quatre coins -> carre unite');
{
  let pire = 0;
  for (const t of [0, 0.13, 0.25, 0.5, 0.617, 0.9, 1]) {
    const m = versUniteN(REPERES, t, L, H);
    // Les coins attendus a ce t, recalcules ici independamment du module.
    let i = 1;
    while (i < REPERES.length - 1 && t > REPERES[i].t) i++;
    const a = REPERES[i - 1], b = REPERES[i];
    const k = Math.min(Math.max((t - a.t) / (b.t - a.t), 0), 1);
    for (const nom of ['HG', 'HD', 'BD', 'BG']) {
      const p = a.coins[nom], q = b.coins[nom];
      const attendu = [(p[0] + (q[0] - p[0]) * k) / L, (p[1] + (q[1] - p[1]) * k) / H];
      const obtenu = appliquer(m, attendu);
      pire = Math.max(pire, Math.abs(obtenu[0] - CIBLES[nom][0]),
                            Math.abs(obtenu[1] - CIBLES[nom][1]));
    }
  }
  verifier('pire erreur sur 7 valeurs de t', pire, 1e-12);
}

// --- 2. Pas de saut au passage d'un repere ----------------------------------
// Un saut de matrice au repere median se verrait comme un a-coup de l'eau au
// milieu du plan. On compare les deux cotes d'une difference finie : l'ecart
// doit etre de l'ordre du pas, pas d'une discontinuite.
console.log('\n2. continuite au repere median (t = 0.5)');
{
  const avant = versUniteN(REPERES, 0.4999, L, H);
  const apres = versUniteN(REPERES, 0.5001, L, H);
  let saut = 0;
  for (let i = 0; i < 9; i++) saut = Math.max(saut, Math.abs(avant[i] - apres[i]));
  verifier('saut de matrice au repere median', saut, 1e-2);
}

// --- 3. Deux reperes, interpolation a mi-course ------------------------------
console.log('\n3. deux reperes, HG a mi-course');
{
  const deux = [REPERES[0], REPERES[2]];
  const m = versUniteN(deux, 0.5, L, H);
  const attendu = [(498 + 430) / 2 / L, (400 + 381) / 2 / H];
  const o = appliquer(m, attendu);
  verifier('HG interpole -> (0,0)', Math.max(Math.abs(o[0]), Math.abs(o[1])), 1e-12);
}

// --- 4. Un seul repere, et le hors-bornes ------------------------------------
console.log('\n4. cas limites');
{
  const un = [REPERES[1]];
  const m = versUniteN(un, 0.77, L, H);
  const o = appliquer(m, [470 / L, 392 / H]);
  verifier('un seul repere : HG -> (0,0)', Math.max(Math.abs(o[0]), Math.abs(o[1])), 1e-12);

  // Le calage ne s'extrapole pas : au-dela des bornes on tient le dernier.
  let ecart = 0;
  const a = versUniteN(REPERES, 1.0, L, H), b = versUniteN(REPERES, 3.7, L, H);
  for (let i = 0; i < 9; i++) ecart = Math.max(ecart, Math.abs(a[i] - b[i]));
  verifier('t > 1 ne s\'extrapole pas', ecart, 1e-15);

  ecart = 0;
  const c = versUniteN(REPERES, 0.0, L, H), d = versUniteN(REPERES, -2.4, L, H);
  for (let i = 0; i < 9; i++) ecart = Math.max(ecart, Math.abs(c[i] - d[i]));
  verifier('t < 0 ne s\'extrapole pas', ecart, 1e-15);
}

// --- 5. inverser() est bien l'inverse ----------------------------------------
console.log('\n5. inverser()');
{
  const m = carreVers([0.39, 0.55], [0.59, 0.55], [0.99, 0.84], [0.0, 0.85]);
  const inv = inverser(m);
  // m . inv doit rendre l'identite, a l'echelle pres (matrices homogenes).
  const col = (M, j) => [M[j * 3], M[j * 3 + 1], M[j * 3 + 2]];
  let pire = 0;
  for (const p of [[0, 0], [1, 0], [1, 1], [0, 1], [0.37, 0.62]]) {
    const q = appliquer(inv, appliquer(m, p));
    pire = Math.max(pire, Math.abs(q[0] - p[0]), Math.abs(q[1] - p[1]));
  }
  verifier('aller-retour m puis inverse(m)', pire, 1e-12);
  void col;
}

console.log(`\n${echecs === 0 ? 'TOUT PASSE' : echecs + ' ECHEC(S)'}\n`);
process.exit(echecs === 0 ? 0 : 1);
