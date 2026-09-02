// Les trois barres de la bascule son.
//
// Ce n'est pas une animation decorative : elles sont branchees sur le bus
// principal et bougent avec ce qu'on entend reellement. Fortes dans la salle
// de velos, presque immobiles au spa, mortes dans le silence de l'ecran final.
//
// Un vumetre decoratif ment sur une page dont le son EST l'argument. Celui-ci
// dit la verite, et il ne coute qu'un noeud d'analyse.

import { contexte, bus } from '../audio/graph.js';
import { VUMETRE_T_DESCENTE } from '../config/constants.js';

/**
 * Trois bandes : grave, medium, aigu.
 *
 * Le decoupage n'est pas cosmetique. Il fait que les trois barres racontent des
 * choses differentes : le bourdon du spa n'allume que la premiere, les insectes
 * du toit n'allument que la troisieme, la musique des velos les allume toutes.
 */
const BANDES = [
  [20, 250],      // le grave : la ville lointaine, le bourdon, la masse d'air
  [250, 2000],    // le medium : les voix, la musique, le corps des pas
  [2000, 12000],  // l'aigu : les oiseaux, les insectes, les cles
];

export function creerVumetre(elements) {
  const c = contexte();

  const analyse = c.createAnalyser();
  // 1024 : assez fin pour separer les trois bandes, assez court pour que la
  // lecture ne coute rien a chaque trame.
  analyse.fftSize = 1024;
  // Le lissage propre a l'analyseur est laisse bas : c'est notre descente
  // temporisee qui donne le comportement, et empiler les deux ferait flotter.
  analyse.smoothingTimeConstant = 0.3;
  bus().connect(analyse);

  const donnees = new Uint8Array(analyse.frequencyBinCount);
  const parBin = c.sampleRate / 2 / analyse.frequencyBinCount;
  const bornes = BANDES.map(([lo, hi]) => [
    Math.floor(lo / parBin),
    Math.min(Math.ceil(hi / parBin), analyse.frequencyBinCount - 1),
  ]);

  const niveaux = [0, 0, 0];
  let dernier = performance.now();

  return {
    /** A appeler a chaque trame. `actif` a faux fige les barres. */
    trame(maintenant, actif) {
      const dt = Math.min((maintenant - dernier) / 1000, 0.1);
      dernier = maintenant;

      if (!actif) {
        // Les barres ne retombent pas a zero, elles se posent : une bascule au
        // silence doit ressembler a un arret, pas a une panne.
        for (let k = 0; k < 3; k++) {
          niveaux[k] += (0.06 - niveaux[k]) * (1 - Math.exp(-dt / 0.4));
          elements[k].style.transform = `scaleY(${(0.12 + niveaux[k]).toFixed(3)})`;
        }
        return;
      }

      analyse.getByteFrequencyData(donnees);
      const alpha = 1 - Math.exp(-dt / VUMETRE_T_DESCENTE);

      for (let k = 0; k < 3; k++) {
        const [d, f] = bornes[k];
        let somme = 0;
        for (let i = d; i <= f; i++) somme += donnees[i];
        const brut = somme / (f - d + 1) / 255;

        // Montee immediate, descente temporisee : la loi d'un vumetre a
        // aiguille. Une descente instantanee ferait clignoter les barres.
        niveaux[k] = brut > niveaux[k] ? brut : niveaux[k] + (brut - niveaux[k]) * alpha;

        // Racine : les niveaux utiles de cette page vivent dans le bas de
        // l'echelle -- une nappe a -30 dB ne bougerait pas une barre lineaire.
        const h = 0.12 + Math.sqrt(Math.min(niveaux[k], 1)) * 0.88;
        elements[k].style.transform = `scaleY(${h.toFixed(3)})`;
      }
    },
  };
}
