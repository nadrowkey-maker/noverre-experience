// L'acces aux octets compresses d'une sequence.
//
// Une responsabilite : aller chercher un fichier et le rendre, sans jamais le
// decoder. Le decodage est le travail de l'anneau, et c'est lui qui coute de la
// memoire ; garder les deux separes est ce qui permet de retenir une sequence
// entiere en octets tout en n'en decodant que quarante images.

import { FRAMES_BASE, FRAMES_EXT } from '../config/sequences.js';

export function creerSource(idSequence) {
  const octets = new Map();     // index -> ArrayBuffer
  const enVol = new Map();      // index -> Promise, pour ne jamais fetcher deux fois
  let cumul = 0;                // octets reellement transferes, pour le debit

  const url = (i) =>
    `${FRAMES_BASE()}/${idSequence}/${String(i).padStart(4, '0')}.${FRAMES_EXT}`;

  async function charger(i) {
    if (octets.has(i)) return octets.get(i);
    if (enVol.has(i)) return enVol.get(i);

    const p = fetch(url(i))
      .then((r) => {
        if (!r.ok) throw new Error(`image ${i} de ${idSequence} : ${r.status}`);
        return r.arrayBuffer();
      })
      .then((b) => {
        octets.set(i, b);
        cumul += b.byteLength;
        enVol.delete(i);
        return b;
      })
      .catch((e) => {
        enVol.delete(i);
        throw e;
      });

    enVol.set(i, p);
    return p;
  }

  return {
    charger,
    aEnMemoire: (i) => octets.has(i),
    /** Octets transferes depuis le debut : sert a mesurer le debit reel. */
    get octetsCharges() { return cumul; },
    /** Libere les octets : appele quand on quitte durablement une sequence. */
    vider: () => { octets.clear(); enVol.clear(); },
  };
}
