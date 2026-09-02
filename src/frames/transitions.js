// La grammaire des transitions (D2).
//
// Un seul dispositif, repete, en deux amplitudes. Une sequence s'eteint sur sa
// sortie et la suivante se rallume sur son entree, par multiplication :
// resultat = image x luminosite. Les ombres meurent donc en premier et les
// bords eclaires en dernier -- ce qu'aucun voile clair ou additif ne ferait.
//
// LES DEUX COTES DOIVENT ETRE COUPES POUR QU'UN RACCORD SOIT DIRECT.
// Desactiver le fondu d'entree du segment suivant ne sert a rien si le
// precedent s'eteint quand meme : le noir est la.
//
// Quatre raccords de Noverre sont DIRECTS et portent `fonduEnchaine: 0`. Ils
// n'ont pas ete decides sur parole mais mesures (tools/mesure-jonctions.py) :
// on compare la derniere image d'un clip a la premiere du suivant, en ecart
// moyen de pixels et en SSIM, avec pour etalon l'ecart entre deux images
// consecutives du milieu d'un clip -- 7,28.
//
//   01 -> 02   ecart 32,9   4,5x l'etalon   SSIM 0,734
//   06 -> 07   ecart 11,1   1,5x            SSIM 0,962
//   10 -> 11   ecart 16,4   2,3x            SSIM 0,882
//   11 -> 12   ecart  8,1   1,1x            SSIM 0,982
//
// Les huit autres jonctions sont entre 5,2x et 12,6x l'etalon, avec un SSIM de
// -0,05 a 0,48 : la separation est franche et sans recouvrement, il n'y a rien
// a interpreter. Elles gardent le fondu enchaine par defaut.
//
// 01 -> 02 est le plus lache des quatre, et c'est visible sur les planches :
// la camera a avance entre les deux plans, la facade est sensiblement plus
// grosse a l'entree du 02. S'il saute a l'usage, le remede n'est PAS de
// chercher une meilleure image de raccord -- une recherche exhaustive sur la
// pire jonction de Parkside n'a gagne que 1 % -- mais de lui rendre un fondu
// tres court.
//
// Le spa est l'exception inverse : sa sortie descend jusqu'au noir et y tient.
// Ce n'est pas un raccord, c'est un changement de lieu -- le spa est sourd,
// humide et immobile, la salle de velos est seche, sombre et rythmee, et un
// raccord franc entre les deux se lirait comme une erreur de montage.

import {
  PART_FONDU, PART_FONDU_SEUIL, PART_TENUE_SEUIL,
  SEUIL_FLOOR, TRANSITION_FLOOR,
} from '../config/constants.js';

/**
 * @param {object} seq      la sequence courante
 * @param {number} t        progression dans la sequence, de 0 a 1
 * @param {boolean} premiere vrai si c'est le premier segment de la page
 * @param {boolean} derniere vrai si c'est le dernier
 * @returns {number} luminosite restante, 1 etant l'image intacte
 */
/**
 * @param {object} seq      la sequence courante
 * @param {number} t        progression dans la sequence, de 0 a 1
 * @returns {number} luminosite restante, 1 etant l'image intacte
 *
 * Deux dispositifs, declares par sequence, et rien par defaut :
 *
 *   `extinctionSortie` { part, plancher, tenue }
 *       la fin du segment descend jusqu'a `plancher` sur `part`, puis y tient
 *       sur `tenue`. Le Seuil s'en sert pour aller au noir et y rester ; le
 *       spa pour eteindre avant que la musique des velos n'arrive.
 *
 *   `allumageEntree` { part, plancher }
 *       le debut du segment remonte de `plancher` a 1. Il ne sert qu'apres une
 *       extinction : on ne rallume que ce qui a ete eteint.
 *
 * Partout ailleurs la luminosite vaut 1 et c'est le fondu ENCHAINE qui fait le
 * raccord. Une baisse de luminosite assombrit sans cacher la coupe -- on voit
 * l'image changer a mi-noir, ce qui se remarque plus qu'une coupe franche.
 */
export function luminositePour(seq, t, { premiere = false, derniere = false } = {}) {
  const all = seq.allumageEntree;
  if (all && !premiere && t < all.part) {
    return all.plancher + (1 - all.plancher) * (t / all.part);
  }

  const ext = seq.extinctionSortie;
  if (!ext || derniere) return 1;

  const debutTenue = 1 - (ext.tenue ?? 0);
  if (t >= debutTenue) return ext.plancher;
  const debutDescente = debutTenue - ext.part;
  if (t > debutDescente) {
    return 1 + (ext.plancher - 1) * ((t - debutDescente) / ext.part);
  }
  return 1;
}
