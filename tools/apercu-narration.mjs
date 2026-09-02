// Photographie la narration a l'instant ou chaque ligne est PLEINE.
//
//   node tools/apercu-narration.mjs
//
// Il ne verifie rien : le contraste se mesure par
// tools/mesure-contraste-narration.py, et la forme de la rampe par
// tools/recette-sequences.mjs. Celui-ci pose les quatorze ecrans cote a cote
// pour qu'on les LISE -- la longueur des lignes, le point de coupure, la place
// dans le cadre. Ce sont des choses qui ne se mesurent pas.

import { mkdirSync } from 'node:fs';
import { ouvrirNavigateur, dormir } from './pilote.mjs';

const BASE = process.env.BASE || 'http://localhost:8000';
const SORTIE = process.env.SORTIE || './build/narration';

const SEGMENT = `((document.getElementById('temoin').textContent.split('—').pop()) || '').trim()`;
const ETAT = `(() => {
  const l = document.getElementById('narration-ligne');
  const v = document.getElementById('narration-voile');
  return { texte: l.textContent, opacite: getComputedStyle(l).opacity,
           voile: getComputedStyle(v).opacity,
           hauteur: l.getBoundingClientRect().height };
})()`;
const POUSSER = (n, d) => `
  (async () => {
    for (let k = 0; k < ${n}; k++) {
      window.dispatchEvent(new WheelEvent('wheel', { deltaY: ${d}, bubbles: true, cancelable: true }));
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    }
    await new Promise(r => setTimeout(r, 120));
    return true;
  })()`;

const nav = await ouvrirNavigateur({ largeur: 1280, hauteur: 720 });
mkdirSync(SORTIE, { recursive: true });
try {
  await nav.aller(`${BASE}/?degraded=0&eau=1`);
  await dormir(1500);
  await nav.evaluer(`document.querySelector('[data-son="non"]').click(), true`);
  for (let a = 0; a < 40; a++) {
    await dormir(400);
    if ((await nav.evaluer(
      `document.getElementById('porte').dataset.etat`)) === 'fini') break;
  }
  await dormir(500);

  console.log(`\n  ${'segment'.padEnd(16)} ${'op'.padStart(5)} ${'voile'.padStart(6)}` +
              ` ${'lignes'.padStart(6)}  texte`);
  const pris = new Set();
  for (let etape = 0; etape < 400; etape++) {
    const seg = await nav.evaluer(SEGMENT);
    const e = await nav.evaluer(ETAT);
    // On photographie au moment ou la ligne est PLEINE : c'est la qu'elle se
    // juge, pas au milieu d'une rampe.
    if (!pris.has(seg) && parseFloat(e.opacite) > 0.98 && e.texte) {
      pris.add(seg);
      const n = String(pris.size).padStart(2, '0');
      await nav.photo(`${SORTIE}/${n}-${seg}.png`);
      // Une hauteur de boite superieure a deux interlignes veut dire trois
      // lignes : c'est ce qu'il ne faut jamais.
      const lignes = Math.round(e.hauteur / 29);
      console.log(`  ${seg.padEnd(16)} ${e.opacite.slice(0, 4).padStart(5)}` +
                  ` ${e.voile.slice(0, 4).padStart(6)} ${String(lignes).padStart(6)}` +
                  `  ${e.texte}`);
    }
    if (seg === 'faits' && pris.has('faits')) break;
    await nav.evaluer(POUSSER(2, 150));
  }
  console.log(`\n  images dans ${SORTIE}`);
} finally {
  await nav.fermer();
}
