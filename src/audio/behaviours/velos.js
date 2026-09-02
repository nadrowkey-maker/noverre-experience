// La chaine de musique-velos — sequences cinq, six-a et six-b.
//
// Une seule chaine pour trois scenes, parce que c'est un seul son qu'on retire
// progressivement : le morceau entier dans la salle de velos, le meme a travers
// un mur dans la salle de sport, puis rien que sa frequence la plus basse dans
// la salle de yoga, qui s'eteint.
//
//   musique-velos -> filtre VITESSE -> filtre MUR -> gain MUR -> bus
//
// Les deux filtres sont en serie et independants. Le premier obeit a la vitesse
// du defilement, le second a la position. Les separer est ce qui permet a la
// pente des trois salles d'etre une seule courbe monotone sans se soucier de ce
// que le visiteur a fait dans la salle de velos.
//
// La piste demarre une seule fois, a la premiere entree. Si le visiteur remonte
// puis redescend, elle ne repart pas du debut : le morceau a continue sans lui.
// Une piece ne rembobine pas sa musique parce que quelqu'un revient.

import { contexte, bus } from '../graph.js';
import { enLineaire } from '../tracks.js';
import {
  VELOS_FILTRE_FERME, VELOS_FILTRE_OUVERT, VELOS_VITESSE_PLEINE, VELOS_TAU_FILTRE,
  MUR_DB_DEBUT, MUR_DB_FIN, MUR_FILTRE_DEBUT, MUR_FILTRE_FIN, MUR_COURBE,
  VELOS_COURBE,
  TAU_GAIN,
} from '../../config/constants.js';

/** Interpolation exponentielle : l'oreille entend les hauteurs en rapport. */
const versFrequence = (de, a, part) => de * Math.pow(a / de, part);

export async function creerChaineVelos(banque) {
  const c = contexte();

  // Le filtre de la vitesse. Q bas : on veut entendre une porte fermee, pas un
  // filtre. Une resonance a la coupure s'entendrait comme un effet.
  const filtreVitesse = c.createBiquadFilter();
  filtreVitesse.type = 'lowpass';
  filtreVitesse.frequency.value = VELOS_FILTRE_FERME;
  filtreVitesse.Q.value = 0.7;

  // Le filtre du mur, et son gain. Ils suivent la meme valeur unique.
  const filtreMur = c.createBiquadFilter();
  filtreMur.type = 'lowpass';
  filtreMur.frequency.value = 18000;   // grand ouvert tant qu'on est aux velos
  filtreMur.Q.value = 0.7;

  const gainMur = c.createGain();
  // La chaine nait MUETTE, et c'est essentiel.
  //
  // Elle se cree au clic sur le son, ou que le visiteur se trouve dans la page.
  // La demarrer au gain de jeu faisait partir le morceau a plein volume des
  // l'arrivee sur le site -- et rien ne le coupait avant la premiere frontiere
  // de segment franchie, la coupure vivant dans le bloc de changement de
  // segment, qui ne se rejoue pas apres le clic.
  //
  // Seuls `vitesse()` et `distance()` la font sonner. Tant que le visiteur
  // n'est pas dans l'une des trois sequences concernees, elle reste a zero.
  gainMur.gain.value = 0;

  filtreVitesse.connect(filtreMur).connect(gainMur).connect(bus());

  await banque.obtenir('musique-velos', filtreVitesse);
  // La piste est mise a son niveau de jeu UNE FOIS, ici, et plus jamais
  // touchee : c'est gainMur qui porte tout le volume. Tant qu'elle n'est
  // declaree dans les couches d'aucune scene, aucun taire() ne peut la couper
  // a une frontiere -- et c'est ce qui garantit qu'elle traverse les trois
  // sequences sans interruption ni redemarrage.
  banque.viser('musique-velos', 0, 0.1);

  // La recompense ne se reprend pas : une fois le morceau arrive en entier, il
  // ne se referme plus, meme si le visiteur ralentit. C'est ce qui en fait une
  // recompense et non un effet.
  let recompense = false;

  return {
    /**
     * Le filtre continu, pilote par la VITESSE du defilement.
     *
     * C'est la seule exception de toute la page a la regle de l'horloge, et
     * c'est ce qui fait que le visiteur pousse pour obtenir la musique : scroll
     * lent, le morceau s'entend comme a travers une porte fermee ; scroll
     * rapide, le filtre s'ouvre.
     *
     * Le gain reste plat -- seul le timbre bouge. Piloter le volume par la
     * vitesse ferait pomper la musique au lieu de l'ouvrir.
     *
     * @param {number} vitesse px/s, signe compris
     * @param {number} image   index courant, pour la recompense
     * @param {object} cfg     `imageRecompense`
     */
    vitesse(vitesse, image, cfg, t = 1) {
      if (!recompense && image >= cfg.imageRecompense) recompense = true;

      const part = recompense
        ? 1
        : Math.pow(Math.min(Math.abs(vitesse) / VELOS_VITESSE_PLEINE, 1), VELOS_COURBE);

      const f = versFrequence(VELOS_FILTRE_FERME, VELOS_FILTRE_OUVERT, part);
      filtreVitesse.frequency.setTargetAtTime(f, c.currentTime, VELOS_TAU_FILTRE / 3);

      // Aux velos le mur n'existe pas : la chaine est grande ouverte.
      filtreMur.frequency.setTargetAtTime(18000, c.currentTime, TAU_GAIN / 3);

      // Le morceau part de ZERO et monte avec le defilement sur la premiere
      // part du segment, pendant que l'image se rallume depuis le noir du spa.
      // Sans cela il arrivait a plein niveau par-dessus le silence du creux,
      // ce qui agressait l'oreille : c'est le seul endroit de la page ou une
      // scene passe du vide absolu a la musique.
      const montee = cfg.montee ? Math.min(t / cfg.montee, 1) : 1;
      const db = montee <= 0 ? -60 : (cfg.db ?? MUR_DB_DEBUT) + (1 - montee) * -30;
      gainMur.gain.setTargetAtTime(enLineaire(db), c.currentTime, 0.25 / 3);
    },

    /**
     * La pente des trois salles : UNE SEULE courbe monotone.
     *
     * De l'entree dans la salle de sport jusqu'a la fin du yoga, une valeur
     * unique -- la distance a la salle de velos -- va de 0 a 1. Deux parametres
     * la suivent, et c'est tout : le volume de 0 a -40 dB, la coupure de 400 a
     * 100 Hz.
     *
     * La salle de yoga n'a AUCUN code propre : elle est la fin de la courbe.
     * Un cas particulier pour elle voudrait dire que la courbe est mal posee.
     *
     * Au franchissement du mur il reste donc une masse grave nettement audible,
     * et le silence n'arrive que vers le milieu de la scene de yoga.
     */
    distance(d) {
      // Concave : la chute est rapide des l'entree puis se calme. Elle part
      // exactement du niveau des velos, donc sans marche a la frontiere.
      const c2 = Math.pow(d, MUR_COURBE);
      const db = MUR_DB_DEBUT + (MUR_DB_FIN - MUR_DB_DEBUT) * c2;
      const f = versFrequence(MUR_FILTRE_DEBUT, MUR_FILTRE_FIN, c2);
      gainMur.gain.setTargetAtTime(enLineaire(db), c.currentTime, TAU_GAIN / 3);
      filtreMur.frequency.setTargetAtTime(f, c.currentTime, TAU_GAIN / 3);
      // Le filtre de la vitesse s'efface : passe le mur, ce n'est plus la main
      // du visiteur qui commande, c'est la distance.
      filtreVitesse.frequency.setTargetAtTime(VELOS_FILTRE_OUVERT, c.currentTime, TAU_GAIN / 3);
    },

    /** Hors de ces trois scenes, la chaine se tait sans s'arreter. */
    taire() {
      gainMur.gain.setTargetAtTime(0, c.currentTime, TAU_GAIN / 3);
    },
  };
}
