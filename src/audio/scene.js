// Le melange d'une scene, pilote par la configuration.
//
// Aucune valeur en dur ici : tout vient de config/sequences.js, pour qu'une
// passe de reglage n'ouvre que ce fichier de configuration et constants.js.
//
// La position du defilement fixe des CIBLES de gain, pas des valeurs. Les
// niveaux glissent vers elles avec une constante de temps d'une a deux
// secondes -- setTargetAtTime fait exactement cela. Le defilement ne pilote
// jamais une tete de lecture : les nappes tournent deja, chacune a sa vitesse
// reelle.

import { bus } from './graph.js';
import { creerNappe } from './tracks.js';
import { creerScellement } from './seal.js';
import { creerDeclencheur } from './one-shots.js';
import { PISTES } from '../config/audio.js';
import { TAU_GAIN } from '../config/constants.js';
import { creerRideau } from './behaviours/rideau.js';
import { creerEau } from './behaviours/eau.js';

/**
 * La courbe d'une couche sur une sequence.
 *
 * `debut` et `fin` suffisent a la plupart. Deux modificateurs pour les cas que
 * le document decrit explicitement :
 *
 *   `bosse`   la couche ne monte pas, elle fait une bosse : maximum a cette
 *             progression, leger retrait ensuite. C'est ce qui rend vrai le
 *             fait qu'en plein jour la ville a gagne et que les oiseaux sont
 *             toujours la dessous.
 *   `retard`  la couche n'entre qu'a partir de cette progression. La ville
 *             proche arrive en dernier, par-dessus la lointaine.
 */
function niveau(c, t) {
  if (typeof c === 'number') return c;
  const { debut, fin, bosse, dbBosse, retard = 0 } = c;
  if (retard > 0 && t < retard) return -60;
  const u = retard > 0 ? (t - retard) / (1 - retard) : t;

  if (bosse !== undefined) {
    return u <= bosse
      ? debut + (dbBosse - debut) * (u / bosse)
      : dbBosse + (fin - dbBosse) * ((u - bosse) / (1 - bosse));
  }
  return debut + (fin - debut) * u;
}

/**
 * Cree le melange d'une sequence. Les nappes sont partagees entre sequences
 * par `banque` : une piste qui sert dans plusieurs scenes ne doit JAMAIS etre
 * dupliquee -- un seul enregistrement joue a des niveaux differents, c'est ce
 * qui fait entendre un lieu plutot qu'une collection de scenes.
 */
export async function creerScene(seq, banque, chaineVelos, traversee = null) {
  const noms = Object.keys(seq.couches || {});
  const scelle = seq.scellement;

  // Les pistes scellees passent par le filtre, les autres vont au bus.
  let scellement = null;
  if (scelle) {
    scellement = creerScellement({
      sortie: bus(),
      dbOuvert: scelle.dbOuvert,
      dbFerme: scelle.dbFerme,
    });
    await Promise.all(scelle.pistes.map((n) => banque.obtenir(n, scellement.entree)));
  }

  await Promise.all(noms.map((n) => banque.obtenir(n)));

  const tirs = (seq.declencheurs || []).map((d) => ({
    def: d,
    tireur: creerDeclencheur(
      PISTES[d.son]?.fichier || `${d.son}.mp3`, { db: d.db ?? -6 }),
  }));

  // Les comportements propres. Chacun n'existe que si la sequence le declare,
  // et chacun est dans son fichier : ils ne partagent que la banque.
  //
  // LA TRAVERSEE FAIT EXCEPTION : elle n'est PAS creee ici. Noverre sort deux
  // fois du batiment et chaque excursion enjambe deux segments, donc quatre
  // scenes la declarent. Quatre instances tomberaient dans le piege de la
  // §6.7 : la banque ne route une piste vers un filtre qu'a sa creation, et les
  // trois dernieres recupereraient `parc-jour` deja branche sur le filtre de la
  // premiere. Une seule instance est donc creee en amont, dans main.js, et
  // partagee -- exactement comme la chaine des velos l'est sur trois scenes.
  const rideau = seq.rideau ? await creerRideau(seq.rideau, banque) : null;
  const eau = seq.eau ? await creerEau(banque) : null;

  let partAvant = null;

  return {
    pret: Promise.all(tirs.map((t) => t.tireur.pret)),

    /**
     * @param {number} t     progression dans la sequence, 0 a 1
     * @param {number} image index d'image courant, DANS LE SEGMENT
     * @param {object} etat  `vitesse` en px/s, `dt` en secondes, et
     *                       `imageGlobale` -- l'index continu sur tout le
     *                       parcours, dont la traversee a besoin parce qu'une
     *                       excursion enjambe deux segments.
     */
    melanger(t, image, { vitesse = 0, dt = 0, imageGlobale = 0 } = {}) {
      // Les couches d'abord, les comportements ensuite : un comportement qui
      // reprend une piste de la scene doit avoir le dernier mot.
      for (const n of noms) banque.viser(n, niveau(seq.couches[n], t), TAU_GAIN);

      if (scellement) {
        const part = Math.min(t / scelle.part, 1);
        if (part !== partAvant) { scellement.fermer(part); partAvant = part; }
      }

      // Les velos : la VITESSE ouvre le filtre, pas la position.
      if (seq.velos && chaineVelos) chaineVelos.vitesse(vitesse, image, seq.velos, t);

      // Les trois salles : une seule valeur de 0 a 1, sur deux segments.
      if (seq.distanceVelos && chaineVelos) {
        const { debut, fin } = seq.distanceVelos;
        // Bornee a 1 : la fin du yoga tient le silence au lieu de l'atteindre
        // seulement a sa derniere image.
        chaineVelos.distance(Math.min(debut + (fin - debut) * t, 1));
      }

      // « Il se tait avant la ville » : a la toute fin du toit les insectes
      // s'eteignent et il ne reste que la circulation, tres loin, sous le vent.
      // Ce n'est pas physiquement exact -- un hammock tropical a minuit est
      // plein d'insectes -- c'est une decision de composition : elle prepare
      // l'ecran suivant, du texte sur noir dans le silence total.
      if (seq.tairAvantLaVille && t >= seq.tairAvantLaVille.de) {
        const u = (t - seq.tairAvantLaVille.de) / (1 - seq.tairAvantLaVille.de);
        const dep = niveau(seq.couches['parc-nuit'], seq.tairAvantLaVille.de);
        banque.viser('parc-nuit', dep + (seq.tairAvantLaVille.dbFin - dep) * u, TAU_GAIN);
      }

      // La traversee lit l'axe GLOBAL : l'index du segment repart a zero a
      // chaque frontiere, et une excursion qui l'enjambe y perdrait son etat.
      if (traversee && seq.traversee) traversee.suivre(imageGlobale);
      if (rideau) rideau.suivre(image, dt);

      for (const { def, tireur } of tirs) {
        if (image >= def.a) tireur.tirer();
      }
    },

    /**
     * L'eau du toit : elle n'obeit pas au defilement mais A LA MAIN, donc elle
     * est pilotee hors de `melanger`, par la scene WebGL qui remonte la vitesse
     * lissee du pointeur.
     */
    eauSuivre(vitesse) { if (eau) eau.suivre(vitesse); },
    get aEau() { return eau !== null; },

    /** Rend les couches muettes en quittant la scene, sans arreter les nappes. */
    taire() {
      for (const n of noms) banque.viser(n, -60, TAU_GAIN);
      if (scellement) { scellement.fermer(0); partAvant = null; }
      for (const { tireur } of tirs) tireur.effacer();
      // La traversee ne se tait PAS ici. Elle est partagee par quatre
      // sequences, et la faire taire depuis la scene qu'on vient de quitter
      // dependrait de l'ordre des appels -- exactement le meme raisonnement que
      // pour la chaine des velos. C'est main.js qui la coupe, sur le seul
      // critere qui vaille : le segment COURANT ne l'utilise pas.
      if (rideau) rideau.taire();
      if (eau) eau.taire();
      // La chaine des velos ne se tait PAS ici. Elle est partagee par trois
      // sequences, et la faire taire depuis la scene quittee dependrait de
      // l'ordre des appels. C'est main.js qui la coupe, sur le seul critere
      // qui vaille : le segment COURANT ne l'utilise pas.
    },
  };
}

/**
 * La banque de nappes.
 *
 * Cinq fichiers servent dans plusieurs scenes et ne doivent jamais etre
 * dupliques. La banque garantit qu'une piste n'existe qu'en un exemplaire,
 * quelle que soit la scene qui la demande.
 */
export function creerBanque() {
  const nappes = new Map();
  const enVol = new Map();

  async function obtenir(nom, sortie = null) {
    if (nappes.has(nom)) return nappes.get(nom);
    if (enVol.has(nom)) return enVol.get(nom);
    const fichier = PISTES[nom]?.fichier;
    if (!fichier) throw new Error(`piste inconnue : ${nom}`);
    const p = creerNappe(fichier, { db: -60, sortie }).then((n) => {
      nappes.set(nom, n); enVol.delete(nom); return n;
    });
    enVol.set(nom, p);
    return p;
  }

  return {
    obtenir,
    viser(nom, db, tau) { nappes.get(nom)?.viser(db, tau); },
    viserLineaire(nom, v, tau) { nappes.get(nom)?.viserLineaire(v, tau); },
    tairTout() { nappes.forEach((n) => n.viser(-60, TAU_GAIN)); },
  };
}
