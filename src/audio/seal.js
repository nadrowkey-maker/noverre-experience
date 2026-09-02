// Le scellement.
//
// « Les pieces se scellent, elles ne se coupent pas. » En passant de
// l'exterieur a l'interieur, le son fait ce que fait une vitre : les aigus
// disparaissent d'abord, un grave etouffe subsiste, puis tout se pose.
//
// Une coupe nette sonne comme un montage. Un scellement sonne comme une
// fenetre, et il vend le vitrage -- ce qui est litteralement l'argument que
// cette page doit porter.
//
// Le mecanisme tient entierement dans le DECALAGE entre deux parametres :
//
//   le passe-bas se referme en 0,2 s, de 18 kHz a 200 Hz
//   le volume met 0,6 a 0,7 s a rejoindre le niveau interieur
//
// Pendant ce decalage il ne reste qu'une masse grave sans aucun detail, encore
// forte, qui s'efface ensuite. C'est ca, la sensation d'une vitre qui se
// referme. Si les deux descendaient ensemble, on entendrait une coupure.

import { contexte } from './graph.js';
import { enLineaire } from './tracks.js';
import {
  SCELLEMENT_FILTRE_OUVERT as FILTRE_OUVERT,
  SCELLEMENT_FILTRE_FERME as FILTRE_FERME,
  SCELLEMENT_T_FILTRE as T_FILTRE,
  SCELLEMENT_T_VOLUME as T_VOLUME,
} from '../config/constants.js';

/**
 * Un scellement pilotable, insere entre des sources exterieures et le bus.
 *
 * `fermer(1)` scelle completement, `fermer(0)` rouvre. La valeur peut etre
 * continue : elle sert aussi bien a une transition franche qu'a un etat tenu.
 */
export function creerScellement({ sortie, dbOuvert, dbFerme, tFiltre = T_FILTRE, tVolume = T_VOLUME }) {
  const c = contexte();

  const filtre = c.createBiquadFilter();
  filtre.type = 'lowpass';
  filtre.frequency.value = FILTRE_OUVERT;
  // Q a 0,7 : pente douce, sans bosse a la coupure. Une resonance ici
  // s'entendrait comme un filtre, or on veut entendre une vitre.
  filtre.Q.value = 0.7;

  const gain = c.createGain();
  gain.gain.value = enLineaire(dbOuvert);

  filtre.connect(gain).connect(sortie);

  let dernier = null;

  return {
    entree: filtre,
    /**
     * @param {number} part 0 = dehors, 1 = scelle
     * @param {object} opts `immediat` pose l'etat sans l'entendre bouger ;
     *   `tFiltre` et `tVolume` remplacent les durees pour CE mouvement.
     *
     * Les durees sont par appel parce que la traversee de vitre n'a pas les
     * memes a l'aller et au retour : a l'aller tout arrive ensemble en trois
     * dixiemes -- on ne franchit pas une vitre progressivement -- au retour le
     * filtre court devant et le volume traine derriere.
     */
    fermer(part, opts = {}) {
      const { immediat = false, tFiltre: tf = tFiltre, tVolume: tv = tVolume } = opts;
      if (part === dernier) return;
      dernier = part;
      const t = c.currentTime;

      // Le filtre se deplace en frequence de facon exponentielle : l'oreille
      // entend les hauteurs en rapport, pas en difference. Une rampe lineaire
      // de 18 kHz a 200 Hz passerait tout son temps dans les aigus inaudibles
      // puis plongerait d'un coup.
      const f = FILTRE_OUVERT * Math.pow(FILTRE_FERME / FILTRE_OUVERT, part);
      const db = dbOuvert + (dbFerme - dbOuvert) * part;

      if (immediat) {
        filtre.frequency.setValueAtTime(f, t);
        gain.gain.setValueAtTime(enLineaire(db), t);
        return;
      }
      filtre.frequency.setTargetAtTime(f, t, tf / 3);
      gain.gain.setTargetAtTime(enLineaire(db), t, tv / 3);
    },
  };
}
