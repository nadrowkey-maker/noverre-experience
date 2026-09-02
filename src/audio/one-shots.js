// Les sons declenches a l'unite.
//
// Deux seulement dans toute la page : la masse d'air du seuil, et le son du
// comptoir. Tout le reste tourne en boucle.
//
// Un verrou empeche qu'ils repartent si le visiteur remonte puis redescend.
// Le document est net la-dessus pour la salle de velos et le principe vaut
// ici : une piece ne rejoue pas son evenement parce que quelqu'un revient.
// Sans verrou, un aller-retour au seuil de declenchement produirait une
// mitraillette de trousseaux de cles.

import { contexte, bus } from './graph.js';
import { AUDIO_BASE } from '../config/audio.js';
import { enLineaire } from './tracks.js';

export function creerDeclencheur(fichier, { db = -6 } = {}) {
  const c = contexte();
  let tampon = null;
  let tire = false;

  const pret = fetch(`${AUDIO_BASE}/${fichier}`)
    .then((r) => {
      if (!r.ok) throw new Error(`${fichier} : ${r.status}`);
      return r.arrayBuffer();
    })
    .then((b) => c.decodeAudioData(b))
    .then((t) => { tampon = t; return t; });

  let gainCourant = null;

  return {
    pret,
    get dejaTire() { return tire; },
    /**
     * Efface la traine si l'on quitte la scene avant qu'elle ne s'eteigne.
     *
     * Le fichier du hall dure 7,4 s dont 6,9 de trainee, et les pas s'y
     * eloignent longtemps. Sans cet effacement ils continuaient dans le spa --
     * or le document exige que le hall soit COMPLETEMENT eteint avant que le
     * spa commence, faute de quoi la scene la plus silencieuse de la page
     * s'ouvre sur les talons de quelqu'un d'autre.
     */
    effacer(tau = 0.6) {
      if (!gainCourant) return;
      gainCourant.gain.setTargetAtTime(0, c.currentTime, tau / 3);
    },
    /**
     * Tire une fois, et une seule pour toute la visite.
     *
     * Rien ne se passe si le son est ferme : le declenchement est perdu, et
     * c'est voulu. Le rejouer plus tard le detacherait de l'image qui le
     * justifie -- un son du comptoir qui tombe alors que le nom est deja sorti
     * du cadre n'est plus un son de la piece, c'est un bruit.
     */
    tirer() {
      if (tire || !tampon) return false;
      tire = true;
      const src = c.createBufferSource();
      const g = c.createGain();
      g.gain.value = enLineaire(db);
      src.buffer = tampon;
      src.connect(g).connect(bus());
      src.start();
      gainCourant = g;
      return true;
    },
    /** Pour le developpement seulement : reautorise un tir. */
    rearmer() { tire = false; },
  };
}
