// L'alimentation des segments voisins.
//
// Le brief demande de charger les images de la sequence suivante pendant que le
// visiteur est dans la courante. Creer son anneau ne suffit pas : un anneau
// alloue est vide, et le decodage ne commencerait qu'au franchissement de la
// frontiere -- l'ecran resterait alors fige sur la derniere image pendant que
// le defilement continue dans le vide.
//
// L'alimentation se fait donc a CHAQUE TRAME tant que le voisin n'est pas
// amorce, et non une seule fois a la frontiere : un franchissement rapide
// arrive avant la fin du decodage.
//
// Le sens compte. On entre dans le segment suivant par ses PREMIERES images et
// dans le precedent par ses DERNIERES : c'est ce qui rend le retour aussi
// fluide que l'aller, et le brief exige que le visiteur puisse revenir.

import {
  TAMPON_DEVANT_PX, TAMPON_DERRIERE_PX, PART_FENETRE,
  RING_SIZE, RING_MAX, DEGRADED_RING_SIZE,
} from '../config/constants.js';

/**
 * La fenetre et l'anneau d'UN segment, calcules sur sa densite d'images.
 *
 * Un segment de 361 images sur la meme distance qu'un segment de 181 avance
 * deux fois plus vite en images par pixel de defilement : a fenetre egale en
 * nombre d'images, son tampon en distance est deux fois plus court. On part
 * donc de la distance voulue et on en deduit le nombre d'images.
 *
 * @param {number} nbImages images du segment
 * @param {number} spanPx   distance de defilement du segment
 * @param {object} cfg      reglages du mode courant
 */
export function fenetrePour(nbImages, spanPx, cfg) {
  const pxParImage = spanPx / Math.max(nbImages - 1, 1);
  const devant = Math.max(4, Math.ceil(TAMPON_DEVANT_PX / pxParImage / cfg.pasImage));
  const derriere = Math.max(2, Math.ceil(TAMPON_DERRIERE_PX / pxParImage / cfg.pasImage));

  const plancher = cfg.degrade ? DEGRADED_RING_SIZE : RING_SIZE;
  const voulu = Math.ceil((devant + derriere + 1) / PART_FENETRE);
  const taille = Math.min(Math.max(voulu, plancher), RING_MAX);

  // Si le plafond mord, on retaille la fenetre pour qu'elle tienne dedans :
  // une fenetre plus large que son anneau le ferait s'evincer lui-meme, ce qui
  // est exactement le bug qu'on vient de corriger.
  const place = Math.floor(taille * PART_FENETRE) - 1;
  if (devant + derriere <= place) return { devant, derriere, taille };
  const k = place / (devant + derriere);
  return {
    devant: Math.max(4, Math.floor(devant * k)),
    derriere: Math.max(2, Math.floor(derriere * k)),
    taille,
  };
}

/**
 * Nombre d'images decodees qui suffit a couvrir un franchissement.
 *
 * Douze : `image()` cherche une voisine jusqu'a douze pas, donc au-dela de
 * douze images amorcees il y a toujours quelque chose a afficher a l'entree du
 * segment, meme si l'exacte n'est pas encore la. En dessous, une entree rapide
 * peut encore tomber dans le trou.
 */
export const AMORCE_VOISIN = 12;

/**
 * Decodages lances par voisin et par trame.
 *
 * Deux : assez pour amorcer douze images en six trames, soit un dixieme de
 * seconde, bien avant qu'un defilement meme rapide ne franchisse la frontiere.
 * Davantage ferait contendre les decodages du segment courant, qui est celui
 * qu'on regarde.
 */
export const PAQUET_PAR_TRAME = 2;

/**
 * Alimente les voisins du segment courant.
 *
 * @param {number[]} voisinage indices a garder charges, courant compris
 * @param {number}   courant   indice du segment affiche
 * @param {Function} anneauPour (i) => anneau
 * @param {Function} nbImages   (i) => nombre d'images du segment
 * @returns {number[]} les indices encore non amorces, pour le temoin
 */
export function alimenterVoisins(voisinage, courant, anneauPour, nbImages) {
  const enRetard = [];
  for (const i of voisinage) {
    if (i === courant) continue;
    const anneau = anneauPour(i);
    // Le suivant s'aborde par son debut, le precedent par sa fin.
    const versLAvant = i > courant;
    const depuis = versLAvant ? 1 : nbImages(i);
    const sens = versLAvant ? +1 : -1;
    if (!anneau.amorcer(depuis, sens, AMORCE_VOISIN, PAQUET_PAR_TRAME)) {
      enRetard.push(i);
    }
  }
  return enRetard;
}
