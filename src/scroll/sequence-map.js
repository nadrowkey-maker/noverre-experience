// Le decoupage du defilement en segments.
//
// Chaque clip est un segment autonome, avec sa propre course. La position
// globale se resout en (segment, progression dans ce segment), et c'est cette
// progression qui pilote a la fois l'index d'image, le melange sonore et la
// luminosite de la transition.
//
// Ici, un clip = un ecran = un segment : contrairement a Parkside, aucune
// sequence n'est coupee en deux.

import { ECRANS_PAR_SEQUENCE } from '../config/constants.js';
import { SEQUENCES, FAITS } from '../config/sequences.js';

/**
 * Les segments parcourus : les treize clips, puis l'ecran des faits.
 *
 * Les faits ferment la page et se defilent comme le reste -- le brief interdit
 * le defilement par cran d'ecran entier, donc ils ne peuvent pas etre un ecran
 * a part qui apparaitrait d'un coup. Mais ils n'ont pas d'images : `sansImage`
 * previent l'orchestration, qui saute pour eux tout ce qui touche aux anneaux.
 */
const SEGMENTS = [...SEQUENCES, FAITS];

export function creerCarte() {
  let hauteur = 0;
  let bornes = [];

  function remesurer() {
    // Chaque segment a SA longueur : les sequences ne font pas le meme travail.
    // L'approche est un passage et tient en cinq ecrans, le spa est un creux
    // qui n'existe que s'il dure et en prend huit, la piscine est construite
    // pour retenir quelqu'un et en prend douze. La valeur vit dans
    // config/sequences.js, avec le reste des reglages de rythme.
    let debut = 0;
    bornes = SEGMENTS.map((seq) => {
      const longueur = (seq.ecrans ?? ECRANS_PAR_SEQUENCE) * window.innerHeight;
      const b = { seq, debut, longueur };
      debut += longueur;
      return b;
    });
    hauteur = debut;
    return debut;
  }

  const longueurTotale = () => remesurer();

  /**
   * Resout une position en segment et progression.
   * La derniere position appartient au dernier segment, progression 1.
   */
  function resoudre(position) {
    for (let i = 0; i < bornes.length; i++) {
      const b = bornes[i];
      if (position < b.debut + b.longueur || i === bornes.length - 1) {
        const t = b.longueur > 0 ? (position - b.debut) / b.longueur : 0;
        return { index: i, seq: b.seq, t: Math.min(Math.max(t, 0), 1) };
      }
    }
    return { index: 0, seq: SEGMENTS[0], t: 0 };
  }

  /**
   * Les segments a garder charges : le courant, et ses deux voisins.
   *
   * On charge les images de la sequence suivante pendant que le visiteur est
   * dans la courante. Le voisin d'avant reste parce que le brief exige que le
   * visiteur puisse revenir : le rejeter ferait payer le retour au prix d'un
   * premier passage.
   */
  // Borne a SEQUENCES et non a SEGMENTS : l'ecran des faits n'a pas d'images,
  // donc il n'a jamais d'anneau a garder ni a preparer.
  const voisinage = (i) =>
    [i - 1, i, i + 1].filter((k) => k >= 0 && k < SEQUENCES.length);

  remesurer();
  return {
    longueurTotale, remesurer, resoudre, voisinage,
    /**
     * Distance de defilement d'UN segment : sert a dimensionner son tampon.
     * Elle varie d'un segment a l'autre, donc elle se demande par index.
     */
    spanDe: (i) => bornes[i]?.longueur ?? 0,
    /** Longueur totale du parcours. */
    get totalPx() { return hauteur; },
    get bornes() { return bornes; },
  };
}
