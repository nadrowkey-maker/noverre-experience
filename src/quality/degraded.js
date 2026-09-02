// Le mode degrade.
//
// Il ne se code pas au jour sept (D8). Le banc n'a pu tourner que sur iPad, qui
// est un plafond et non un plancher : rien ne nous dit ce que fait un appareil
// plus faible. Ce mode cesse donc d'etre un filet de securite pour devenir la
// seule protection des appareils que nous ne pouvons pas mesurer, et une
// protection jamais declenchee pendant le developpement ne protege rien.
//
// D'ou le forcage par ?degraded=1 et ?degraded=0, actif dans les deux sens.

import {
  DEGRADED_MIN_CORES,
  DEGRADED_FIRST_RENDER_MS,
  DEGRADED_FRAME_STEP,
  DEGRADED_RING_SIZE,
  DEGRADED_FENETRE_MS,
  DEGRADED_PART_TRAMES_LENTES,
  DEGRADED_TRAME_LENTE_MS,
  RING_SIZE,
} from '../config/constants.js';

/** Lit ?eau=1 ou ?eau=0, pour mesurer ce que le bassin coute vraiment. */
function forcageEau() {
  const v = new URLSearchParams(location.search).get('eau');
  if (v === null) return null;
  return v !== '0' && v !== 'false';
}

/** Lit ?degraded=1 ou ?degraded=0. Renvoie null si le parametre est absent. */
function forcage() {
  const v = new URLSearchParams(location.search).get('degraded');
  if (v === null) return null;
  return v !== '0' && v !== 'false';
}

const etat = {
  actif: false,
  raison: 'non declenche',
  force: false,
};

/**
 * Decide du mode avant le premier rendu, sur ce qui est connaissable a froid.
 * Le second declencheur — la duree du premier rendu — ne peut etre evalue
 * qu'apres, par `evaluerPremierRendu`.
 */
export function deciderAFroid() {
  const f = forcage();
  if (f !== null) {
    etat.actif = f;
    etat.force = true;
    etat.raison = f ? 'force par ?degraded=1' : 'desactive par ?degraded=0';
    return etat;
  }
  const coeurs = navigator.hardwareConcurrency || 0;
  if (coeurs && coeurs < DEGRADED_MIN_CORES) {
    etat.actif = true;
    etat.raison = `${coeurs} coeurs, sous le seuil de ${DEGRADED_MIN_CORES}`;
  }
  return etat;
}

/**
 * Second declencheur du brief : si le premier rendu depasse 22 ms, on bascule.
 * Sans effet si le mode a ete force a la main, dans un sens ou dans l'autre.
 */
export function evaluerPremierRendu(ms) {
  if (etat.force || etat.actif) return etat;
  if (ms > DEGRADED_FIRST_RENDER_MS) {
    etat.actif = true;
    etat.raison = `premier rendu a ${ms.toFixed(1)} ms, au-dessus de ${DEGRADED_FIRST_RENDER_MS}`;
  }
  return etat;
}

/**
 * La chute d'images soutenue, seul declencheur dynamique.
 *
 * Fenetre glissante de deux secondes. Un appareil peut passer les deux
 * controles statiques du brief puis saccader ; c'est exactement le trou que ce
 * declencheur ferme. La fenetre est assez longue pour qu'un a-coup isole ne
 * fasse pas basculer la page.
 */
const fenetre = [];
export function signalerTrame(dtMs, maintenant) {
  if (etat.force || etat.actif) return etat;
  fenetre.push({ t: maintenant, lente: dtMs > DEGRADED_TRAME_LENTE_MS });
  while (fenetre.length && maintenant - fenetre[0].t > DEGRADED_FENETRE_MS) fenetre.shift();

  // Il faut une fenetre pleine avant de juger : les premieres trames d'une page
  // sont toujours irregulieres, et les compter ferait basculer tout le monde.
  //
  // MAIS ELLE SE MESURE EN TEMPS, PAS EN NOMBRE DE TRAMES. La condition etait
  // `fenetre.length < 60` sur une fenetre de deux secondes : elle exigeait donc
  // TRENTE IMAGES PAR SECONDE pour avoir le droit de juger. Autrement dit, plus
  // l'appareil peinait, moins le declencheur pouvait partir -- et sous les
  // trente images par seconde, c'est-a-dire exactement le cas qu'il existe pour
  // rattraper, il ne partait JAMAIS. Mesure a l'appui : un telephone bride a
  // quatre fois tournait a 3 img/s, et le temoin annoncait « normal ».
  //
  // On demande donc que la fenetre COUVRE sa duree, avec assez de trames pour
  // qu'un a-coup isole ne decide de rien.
  const couvre = fenetre[fenetre.length - 1].t - fenetre[0].t;
  if (fenetre.length < 8 || couvre < DEGRADED_FENETRE_MS * 0.8) return etat;
  const part = fenetre.filter((f) => f.lente).length / fenetre.length;
  if (part > DEGRADED_PART_TRAMES_LENTES) {
    etat.actif = true;
    etat.raison = `${Math.round(part * 100)} % de trames au-dessus de 33 ms sur 2 s`;
    notifier();
  }
  return etat;
}

// Les deux declencheurs tardifs surviennent en cours de visite : il faut que la
// page puisse se reconfigurer, ce que le declencheur a froid n'exigeait pas.
let abonne = null;
export const surBascule = (fn) => { abonne = fn; };
const notifier = () => { if (abonne) abonne(); };

export const estDegrade = () => etat.actif;
export const raisonDegrade = () => etat.raison;

/**
 * Les reglages qui decoulent du mode. Un seul endroit les decide.
 *
 * La fenetre n'est plus ici : elle depend de la densite d'images du segment et
 * se calcule par `fenetrePour`, dans frames/prefetch.js. Une fenetre commune a
 * tous les segments donnait a la salle de velos, deux fois plus dense, la
 * moitie du tampon des autres.
 */
export function reglages() {
  return {
    degrade: etat.actif,
    pasImage: etat.actif ? DEGRADED_FRAME_STEP : 1,
    // L'EAU NE DEPEND PLUS DU MODE DEGRADE. Le levier de ce mode est le
    // DECODAGE -- une image sur deux -- et le bassin est du travail de carte
    // graphique : un appareil qui peine a decoder ne peine pas forcement a
    // dessiner, et on lui retirait le final du site sur une presomption qu'on
    // ne pouvait pas verifier depuis un poste de developpement.
    //
    // C'est desormais le bassin lui-meme qui se retire s'il ne tient pas les
    // trente images par seconde pendant qu'il dessine (voir main.js). Il n'y a
    // plus a deviner : chaque appareil repond pour lui.
    eau: forcageEau() ?? true,
    // `?eau=1` ne dit pas seulement « pose l'eau », il dit « et ne la retire
    // pas » : un forcage explicite vaut dans les deux sens, comme ?degraded.
    eauForcee: forcageEau() === true,
  };
}
