// Les traversees de facade — le passage le plus technique de la page.
//
// Tout s'y joue sur le DECALAGE entre deux parametres. Ce ne sont pas les
// valeurs qui font l'effet, c'est l'ecart entre elles.
//
//   L'ALLER, au franchissement :
//     les pistes exterieures arrivent ENSEMBLE, filtre et volume en meme temps,
//     en trois dixiemes de seconde. On ne traverse pas une facade
//     progressivement -- une fois le verre franchi il n'y a physiquement plus
//     rien entre l'interieur et l'exterieur. C'est le seul mouvement brusque
//     autorise de toute la page.
//
//   LE RETOUR, en rentrant :
//     le passe-bas se referme en deux dixiemes, de 18 kHz a 200 Hz : les aigus
//     disparaissent presque instantanement.
//     Le volume, lui, met six a sept dixiemes a rejoindre le niveau interieur.
//
// Pendant ce decalage il ne reste qu'une masse grave sans aucun detail, encore
// forte, qui s'efface ensuite. C'est ca, la sensation d'une vitre qui se
// referme. Si les deux parametres descendaient ensemble on entendrait une
// coupure -- et une coupure sonne comme un montage, jamais comme une fenetre.
//
// DEUX COUPLES DE SEUILS, ET UNE SEULE INSTANCE. C'est la difference avec
// Parkside, qui n'avait qu'une traversee.
//
// Noverre sort deux fois : par le vitrage de la salle de sport, et par la baie
// du balcon. Deux instances separees tomberaient droit dans le piege de la
// §6.7 -- la banque ne route une piste vers un filtre qu'A SA CREATION, donc la
// seconde traversee recupererait `parc-jour` deja branche sur le filtre de la
// premiere, et son scellement a elle n'aurait aucun effet.
//
// L'index recu est un index d'image GLOBAL, continu d'un bout a l'autre du
// parcours : une excursion qui enjambe deux segments garde alors un axe
// monotone, alors que l'index d'un segment repart a zero a chaque frontiere.
//
// DEUX SORTES DE FRANCHISSEMENT, et le second n'est pas dans la passation.
//
//   une VITRE      evenement a une image, comme le decrit la §6.7. Rien ne
//                  passe tant qu'on est derriere le verre, tout passe apres.
//   une BAIE DEJA OUVERTE   il n'y a rien a franchir. Le dehors entre deja, de
//                  plus en plus fort a mesure qu'on s'en approche, puis gagne
//                  encore un cran une fois le plan de facade passe. Le declarer
//                  comme une vitre serait faux : on verrait une baie ouverte et
//                  l'on n'entendrait rien jusqu'au dernier metre.
//
// C'est le cas du balcon, et c'est une lecture de l'image, pas une preference :
// les coulissants y sont ecartes.

import { bus } from '../graph.js';
import { creerScellement } from '../seal.js';
import {
  TRAVERSEE_T_ALLER,
  SCELLEMENT_T_FILTRE, SCELLEMENT_T_VOLUME, TAU_GAIN,
} from '../../config/constants.js';

export async function creerTraversee(cfg, banque) {
  const pistes = Object.keys(cfg.dehors);

  // Le scellement porte les durees du RETOUR par defaut : c'est lui le moment
  // que ces sequences existent pour produire. L'aller les remplace a l'appel.
  const scellement = creerScellement({
    sortie: bus(),
    dbOuvert: 0,          // le niveau de chaque piste est porte par la piste
    dbFerme: cfg.dbDedans,
    tFiltre: SCELLEMENT_T_FILTRE,
    tVolume: SCELLEMENT_T_VOLUME,
  });

  await Promise.all(pistes.map((n) => banque.obtenir(n, scellement.entree)));

  const DEDANS = 'dedans', DEHORS = 'dehors', APPROCHE = 'approche';
  let etat = null;

  /**
   * Ou en est-on a cet index global ?
   *
   * Lu de la POSITION, jamais d'un evenement passe : c'est ce qui fait que
   * remonter rejoue le mouvement dans l'autre sens sans rien de special a
   * ecrire.
   *
   * @returns {{etat: string, part: number}} `part` ne sert qu'a l'approche :
   *   0 au debut de la fuite, 1 au plan de facade.
   */
  function situer(image) {
    for (const p of cfg.passages) {
      if (image >= p.sortie && image < p.retour) return { etat: DEHORS, part: 1 };
      if (p.approche && image >= p.approche.de && image < p.sortie) {
        const d = p.sortie - p.approche.de;
        return { etat: APPROCHE, part: d > 0 ? (image - p.approche.de) / d : 1 };
      }
    }
    return { etat: DEDANS, part: 0 };
  }

  /** Pose l'etat interieur : couches exterieures plates et basses, scelle. */
  function poserInterieur(immediat) {
    for (const n of pistes) {
      banque.viser(n, cfg.dbDehorsAvant, immediat ? 0.01 : SCELLEMENT_T_VOLUME);
    }
    if (cfg.pisteInterieure) {
      banque.viser(cfg.pisteInterieure, cfg.dbInterieure, immediat ? 0.01 : 1.5);
    }
    scellement.fermer(1, immediat
      ? { immediat: true }
      : { tFiltre: SCELLEMENT_T_FILTRE, tVolume: SCELLEMENT_T_VOLUME });
  }

  poserInterieur(true);
  etat = DEDANS;

  return {
    /**
     * @param {number} image index d'image GLOBAL, continu sur tout le parcours
     */
    suivre(image) {
      const { etat: voulu, part } = situer(image);
      const change = voulu !== etat;
      etat = voulu;

      if (voulu === DEDANS) {
        // On ne repose l'interieur qu'AU CHANGEMENT : c'est un mouvement, avec
        // le filtre qui court devant et le volume qui traine derriere. Le
        // rejouer a chaque trame le figerait a son point de depart.
        if (change) poserInterieur(false);
        return;
      }

      // --- DEHORS et APPROCHE : ON REAFFIRME LES NIVEAUX A CHAQUE TRAME ------
      //
      // C'est la correction d'un defaut entendu, et il etait vicieux. Quatre
      // scenes declarent `parc-jour`, `lointain` ou `vent` dans leurs couches,
      // et `scenesBasculer` appelle `taire()` sur toutes les scenes qui ne sont
      // pas la scene courante -- ce qui pousse ces pistes a -60 A CHAQUE
      // FRANCHISSEMENT DE FRONTIERE.
      //
      // Or une excursion enjambe justement une frontiere : on sortait par le
      // vitrage de la salle de sport, on entendait le dehors, et deux secondes
      // plus tard, au passage dans le yoga, tout redevenait « interieur » alors
      // qu'on etait encore dehors. La traversee ne re-disait rien, parce que
      // son etat, lui, n'avait pas change.
      //
      // Reaffirmer a chaque trame est exactement ce que fait deja le melangeur
      // pour les couches ordinaires : viser une cible qu'on tient deja ne coute
      // rien et ne s'entend pas.
      const glissant = change ? TRAVERSEE_T_ALLER : TAU_GAIN;

      if (voulu === DEHORS) {
        for (const n of pistes) banque.viser(n, cfg.dehors[n], glissant);
      } else {
        // L'APPROCHE : le dehors entre deja, attenue, et se rapproche de son
        // plein niveau a mesure qu'on avance vers la baie. Il reste en dessous
        // -- c'est le franchissement qui donne le dernier cran, sinon passer le
        // plan de facade ne s'entendrait pas.
        const att = cfg.approcheAttenuation ?? 16;
        for (const n of pistes) {
          banque.viser(n, cfg.dehors[n] - att * (1 - part), glissant);
        }
      }

      // Le dehors entendu de l'interieur n'a plus lieu d'etre : on EST dehors,
      // ou presque. Meme raisonnement, meme reaffirmation.
      if (cfg.pisteInterieure) {
        banque.viser(cfg.pisteInterieure, -60, glissant);
      }

      // Le scellement, LUI, ne se rejoue qu'au changement : c'est une rampe
      // exponentielle en frequence, et la relancer a chaque trame la figerait
      // a son point de depart -- on n'entendrait plus jamais la vitre s'ouvrir.
      if (change) {
        scellement.fermer(0, { tFiltre: TRAVERSEE_T_ALLER, tVolume: TRAVERSEE_T_ALLER });
      }
    },

    /**
     * La traversee rend la main : elle redevient TRANSPARENTE.
     *
     * LE SCELLEMENT S'OUVRE EN GRAND, et c'est le point. Il ne se referme pas.
     *
     * Cette instance est creee une fois pour toute la visite, et elle route
     * `foret-jour`, `parc-jour`, `lointain` et `vent` a travers son filtre DES
     * LEUR CREATION -- la banque ne route une piste qu'a ce moment-la, et rien
     * ne peut la debrancher ensuite. Le filtre est donc sur le chemin de ces
     * quatre pistes du premier au dernier ecran, y compris sur les onze
     * sequences qui n'ont aucune traversee.
     *
     * Le laisser ferme y mettait un passe-bas a 200 Hz et -46 dB sur tout ce
     * que ces pistes jouent. Consequence entendue : le lever du jour de la
     * premiere sequence ne donnait plus rien -- la nuit se retirait, et le jour
     * arrivait derriere une vitre fermee -- et la part de jour de la piscine
     * non plus. Seul `parc-nuit`, qui n'est pas dans `dehors`, passait.
     *
     * Hors excursion, le filtre doit donc etre neutre et les niveaux revenir au
     * melangeur. On rend les pistes a -60 : celles que la scene courante
     * declare sont relevees des la trame suivante par `melanger`, qui tourne a
     * chaque trame ; celles qu'elle ne declare pas doivent effectivement se
     * taire.
     */
    taire() {
      for (const n of pistes) banque.viser(n, -60, 1.5);
      scellement.fermer(0, { immediat: true });
      etat = DEDANS;
    },
  };
}
