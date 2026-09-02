// Photographie l'amorce a plusieurs instants, pour la juger a l'oeil.
//
//   node tools/apercu-amorce.mjs [largeur-du-logo] [flou]
//
// Les neuf secondes de l'ouverture ne se jugent pas sur des nombres. Ce banc ne
// verifie rien : il pose des images cote a cote pour qu'on decide.
//
// Le minutage, lui, ne se discute pas -- il est cale sur `logo.mp3` et le
// fichier est le meme que sur Parkside. Ce qui se regle ici est la GEOMETRIE :
// NOVERRE est un mot long et fin (rapport d'encre 6,90) la ou celui de Parkside
// etait trapu (3,21), et la meme largeur d'affichage ne lui donne pas la meme
// presence.

import { mkdirSync } from 'node:fs';
import { ouvrirNavigateur, dormir } from './pilote.mjs';

const BASE = process.env.BASE || 'http://localhost:8000';
const SORTIE = process.env.SORTIE || './build/amorce';
const largeur = process.argv[2] || null;      // ex. "min(46vw, 520px)"
const flou = process.argv[3] || null;         // ex. "22"

// Les instants qui comptent, en secondes depuis le clic. Ils viennent des
// constantes de l'ouverture : apparition a 0,35 ; drop a 6,0 ; le logo tient
// deux secondes par-dessus le batiment ; fin a 9,4.
const INSTANTS = [0.6, 2.0, 4.0, 5.8, 6.4, 8.0, 9.2];

const nav = await ouvrirNavigateur({ largeur: 1280, hauteur: 720 });
mkdirSync(SORTIE, { recursive: true });
try {
  await nav.aller(`${BASE}/`);
  await dormir(2000);

  if (largeur || flou) {
    await nav.evaluer(`(() => {
      const l = document.getElementById('porte-logo');
      ${largeur ? `l.style.width = ${JSON.stringify(largeur)};` : ''}
      ${flou ? `l.dataset.flouForce = ${JSON.stringify(flou)};` : ''}
      return true;
    })()`);
  }

  const t0 = Date.now();
  await nav.evaluer(`document.querySelector('[data-son="oui"]').click(), true`);
  for (const s of INSTANTS) {
    const attendre = t0 + s * 1000 - Date.now();
    if (attendre > 0) await dormir(attendre);
    const nom = `${SORTIE}/t${String(s).replace('.', '_')}.png`;
    await nav.photo(nom);
    const etat = await nav.evaluer(`(() => {
      const l = document.getElementById('porte-logo');
      const st = getComputedStyle(l);
      return { opacite: st.opacity, filtre: st.filter, largeur: st.width,
               voile: getComputedStyle(document.getElementById('porte-voile')).opacity };
    })()`);
    console.log(`  t=${String(s).padStart(4)} s   logo op ${etat.opacite.padStart(5)}` +
                `  ${etat.largeur.padStart(8)}  voile ${etat.voile.padStart(5)}  ${etat.filtre}`);
  }
  console.log(`\nimages dans ${SORTIE}`);
} finally {
  await nav.fermer();
}
