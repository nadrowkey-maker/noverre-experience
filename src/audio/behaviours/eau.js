// L'eau du toit — le seul son de la page qui n'obeisse pas au defilement.
//
// Les pedales obeissent au defilement. L'eau obeit A LA MAIN, et elle continue
// de bouger quand le defilement s'est arrete. Deux extremites de la page, deux
// facons de la toucher -- et c'est pour cette raison que cet ecran est le seul
// construit pour retenir quelqu'un plutot que pour le faire avancer.
//
// La piste tourne du premier au dernier cadre du toit, a gain nul, et ne
// demarre ni ne s'arrete jamais. Seul son volume suit la vitesse lissee du
// pointeur : le mecanisme est celui du rideau, applique a un autre geste.

import { contexte } from '../graph.js';
import { enLineaire } from '../tracks.js';
import {
  VITESSE_PLEINE, EAU_GAIN_MAX, EAU_T_GAIN, EAU_T_SORTIE,
} from '../../config/eau.js';

export async function creerEau(banque) {
  const c = contexte();
  await banque.obtenir('eau');

  // La piste est GAREE A ZERO, franchement, des sa creation.
  //
  // Il n'y a pas de gain de scene separe pour l'eau : `viser` et `viserLineaire`
  // ecrivent sur le meme noeud. La mettre a 0 dB « pour la mettre a son niveau
  // de jeu » revenait donc a la mettre a fond des l'arrivee sur le toit, et le
  // garde-fou de `suivre` -- qui compare a une valeur comptable partie de zero
  // -- concluait qu'il n'y avait rien a faire. L'eau restait ouverte en grand,
  // sans que personne ne l'ait touchee. Meme piege que le morceau des velos.
  banque.viserLineaire('eau', 0, 0.01);
  let gain = 0;

  return {
    /**
     * @param {number|null} vitesse vitesse lissee du pointeur, en px par trame,
     *   ou null si le pointeur a quitte le bassin.
     */
    suivre(vitesse) {
      let cible, tau;
      if (vitesse === null) {
        // Le pointeur a quitte le bassin : retour au silence, sans precipitation.
        cible = 0; tau = EAU_T_SORTIE;
      } else {
        const part = Math.min(vitesse / VITESSE_PLEINE, 1);
        cible = part * EAU_GAIN_MAX;
        // 0,08 s : LE chiffre critique. La commande arrive image par image, et
        // sans ce lissage le gain saute en escalier et l'on entend un
        // gresillement. Avec, la main est suivie sans latence perceptible.
        tau = EAU_T_GAIN;
      }
      if (Math.abs(cible - gain) < 1e-4) return;
      gain = cible;
      // Le gain est LINEAIRE ici, et non en decibels : il suit une vitesse, pas
      // un niveau de melange. C'est la seule piste de la page dans ce cas.
      banque.viserLineaire('eau', cible, tau);
    },

    taire() { gain = 0; banque.viserLineaire('eau', 0, EAU_T_SORTIE); },
  };
}
