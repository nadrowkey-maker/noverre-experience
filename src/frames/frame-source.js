// L'acces aux octets compresses d'une sequence.
//
// Une responsabilite : aller chercher un fichier et le rendre, sans jamais le
// decoder. Le decodage est le travail de l'anneau, et c'est lui qui coute de la
// memoire ; garder les deux separes est ce qui permet de retenir une sequence
// entiere en octets tout en n'en decodant que quarante images.

import { FRAMES_BASE, FRAMES_EXT } from '../config/sequences.js';
import { PLAFOND_REQUETES_EN_VOL } from '../config/constants.js';

/**
 * Les requetes en vol, TOUTES SEQUENCES CONFONDUES.
 *
 * Le compteur est au niveau du module et non de la source : trois anneaux
 * vivent en meme temps -- le segment courant et ses deux voisins -- et chacun
 * demande a chaque trame. Un plafond par source laisserait passer le triple.
 *
 * Voir PLAFOND_REQUETES_EN_VOL pour la mesure qui a impose ce plafond.
 */
let enVolTotal = 0;

/** Reste-t-il de la place sur la liaison ? Question posee AVANT de demander. */
export const placeSurLaLiaison = () => enVolTotal < PLAFOND_REQUETES_EN_VOL;

export function creerSource(idSequence) {
  const octets = new Map();     // index -> ArrayBuffer
  const enVol = new Map();      // index -> Promise, pour ne jamais fetcher deux fois
  let cumul = 0;                // octets reellement transferes, pour le debit

  const url = (i) =>
    `${FRAMES_BASE()}/${idSequence}/${String(i).padStart(4, '0')}.${FRAMES_EXT}`;

  async function charger(i) {
    if (octets.has(i)) return octets.get(i);
    if (enVol.has(i)) return enVol.get(i);

    enVolTotal++;
    const p = fetch(url(i))
      .then((r) => {
        if (!r.ok) throw new Error(`image ${i} de ${idSequence} : ${r.status}`);
        return r.arrayBuffer();
      })
      .then((b) => {
        octets.set(i, b);
        cumul += b.byteLength;
        return b;
      })
      .finally(() => {
        // LE JETON SE REND DANS TOUS LES CAS, succes comme echec. Un jeton
        // perdu sur une erreur ferait retrecir le plafond a chaque incident
        // jusqu'a bloquer la page pour de bon -- le defaut qu'on repare, en
        // pire.
        enVolTotal--;
        enVol.delete(i);
      });

    enVol.set(i, p);
    return p;
  }

  return {
    charger,
    aEnMemoire: (i) => octets.has(i),
    /**
     * La liaison accepte-t-elle une requete de plus ?
     *
     * L'anneau la pose AVANT de demander : ce qui est refuse sera redemande a
     * la trame suivante, depuis la position courante. C'est ce qui remplace une
     * file perimee par une demande toujours a jour.
     */
    placeSurLaLiaison,
    /** Octets transferes depuis le debut : sert a mesurer le debit reel. */
    get octetsCharges() { return cumul; },
    /** Libere les octets : appele quand on quitte durablement une sequence. */
    vider: () => { octets.clear(); enVol.clear(); },
  };
}
