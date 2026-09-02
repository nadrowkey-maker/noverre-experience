// Les mesures de chargement — celles que la passation signale comme JAMAIS
// FAITES sur Parkside (§10.9), et qu'elle demande de faire le PREMIER jour.
//
//   python tools/serve.py &
//   node tools/mesure-chargement.mjs
//
// Trois chiffres, et le troisieme est celui qui compte pour ce site.
//
//   LCP                le plus gros element peint. Cible < 2,5 s en 4G lente.
//   premiere image     l'instant ou la PREMIERE IMAGE DE LA SEQUENCE est peinte
//                      sur le canvas. C'est le vrai « premier ecran » ici : le
//                      LCP peut tomber sur le canvas vide, qui ne montre rien.
//   defilable          l'instant ou le moteur rend la main. Cible < 3 s.
//
// La bride reseau est celle de la 4G lente de Lighthouse : 1638 kbit/s en
// descente, 675 en montee, 150 ms de latence. On la pose par le protocole de
// debogage plutot que d'installer Lighthouse, parce que c'est exactement ce que
// Lighthouse fait, et que le chiffre qui nous interesse est la mesure, pas la
// note sur cent.
//
// AVERTISSEMENT, et il est important : ces mesures sont prises SANS GPU, en
// rendu logiciel. Le reseau est simule fidelement, le decodage ne l'est pas --
// il sera plus rapide sur une vraie machine et plus lent sur un vrai telephone
// bas de gamme. Le chiffre a retenir d'ici est le RESEAU ; le decodage se
// mesure sur du materiel reel (§10.9).

import { ouvrirNavigateur, dormir } from './pilote.mjs';

const BASE = process.env.BASE || 'http://localhost:8000';

/** La 4G lente de Lighthouse, a la valeur pres. */
const QUATRE_G = {
  offline: false,
  downloadThroughput: (1638.4 * 1024) / 8,
  uploadThroughput: (675 * 1024) / 8,
  latency: 150,
};

const SONDE = `
  window.__mesures = { debut: performance.now() };
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) window.__mesures.lcp = e.startTime;
  }).observe({ type: 'largest-contentful-paint', buffered: true });

  // La premiere image REELLEMENT peinte sur le canvas. On l'attrape en
  // observant le canvas plutot qu'en instrumentant le code de production :
  // une sonde dans main.js finirait par y rester.
  // La sonde s'execute AVANT le document -- c'est tout son interet, sinon le
  // LCP serait deja passe -- donc #scene n'existe pas encore. On attend le DOM.
  addEventListener('DOMContentLoaded', () => {
    const c = document.getElementById('scene');
    if (!c) return;
    const test = () => {
      const p = document.createElement('canvas');
      p.width = 16; p.height = 9;
      const x = p.getContext('2d');
      try { x.drawImage(c, 0, 0, 16, 9); } catch { return false; }
      const d = x.getImageData(0, 0, 16, 9).data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] > 6 || d[i+1] > 6 || d[i+2] > 6) return true;
      }
      return false;
    };
    const boucle = () => {
      if (window.__mesures.premiereImage) return;
      if (test()) { window.__mesures.premiereImage = performance.now(); return; }
      requestAnimationFrame(boucle);
    };
    requestAnimationFrame(boucle);
  });
`;

const nav = await ouvrirNavigateur({ largeur: 1280, hauteur: 720 });
try {
  console.log('\nmesures de chargement — 4G lente simulee (1638 kbit/s, 150 ms)\n');

  // La sonde doit exister AVANT le document, sinon le LCP est deja passe.
  await nav.avantChaqueDocument(SONDE);
  await nav.brider(QUATRE_G);

  const t0 = Date.now();
  await nav.aller(`${BASE}/`);
  await dormir(9000);

  const m = await nav.evaluer(`(() => {
    const n = performance.getEntriesByType('navigation')[0] || {};
    const p = performance.getEntriesByType('paint');
    return {
      ...window.__mesures,
      fcp: (p.find(e => e.name === 'first-contentful-paint') || {}).startTime,
      domContentLoaded: n.domContentLoadedEventEnd,
      chargement: n.loadEventEnd,
      transfere: performance.getEntriesByType('resource')
        .reduce((s, r) => s + (r.transferSize || 0), 0),
      requetes: performance.getEntriesByType('resource').length,
    };
  })()`);

  const ligne = (nom, v, cible) => {
    const ok = cible === undefined ? '    ' : (v <= cible ? 'ok  ' : 'HAUT');
    console.log(`  ${ok} ${nom.padEnd(30)} ${v === undefined ? 'n/d' : (v / 1000).toFixed(2) + ' s'}` +
                (cible !== undefined ? `   cible ${(cible / 1000).toFixed(1)} s` : ''));
  };
  ligne('first contentful paint', m.fcp);
  ligne('largest contentful paint', m.lcp, 2500);
  ligne('premiere image peinte', m.premiereImage, 3000);
  ligne('DOM content loaded', m.domContentLoaded);
  ligne('load', m.chargement);
  console.log(`\n       ${'requetes au chargement'.padEnd(30)} ${m.requetes}`);
  console.log(`       ${'octets transferes'.padEnd(30)} ${(m.transfere / 1024).toFixed(0)} ko`);
  console.log('\n  Rappel : le reseau est simule fidelement, le DECODAGE ne l\'est pas.');
  console.log('  Le plancher de 30 images par seconde se mesure sur du materiel reel.\n');
} finally {
  await nav.fermer();
}
