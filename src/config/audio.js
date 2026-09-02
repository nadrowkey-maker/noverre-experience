// Les seize pistes : la correspondance nom vers fichier, et rien d'autre.
//
// Les NIVEAUX ne sont pas ici. Ils vivent dans config/sequences.js, scene par
// scene, parce qu'un meme enregistrement joue a des niveaux differents selon
// l'endroit -- c'est precisement ce qui fait entendre un lieu plutot qu'une
// collection de scenes. Une passe de reglage n'ouvre donc que sequences.js et
// constants.js.
//
// LA PALETTE EST TRANSPOSEE DEPUIS PARKSIDE (§6.8). Noverre n'est pas en
// centre-ville, et « baisser le gain des pistes de ville » ne marche pas : ce
// qui change avec la distance est le SPECTRE avant le niveau. Trois decisions,
// chacune appuyee sur une mesure (tools/mesure-spectre.py) :
//
//   ville-proche      RETIREE. Ses evenements identifiables -- une portiere, un
//                     klaxon -- sont ce qui fait entendre un centre-ville. Elle
//                     ne se baisse pas, elle se retire.
//
//   ville-lointaine   RENOMMEE `lointain`, et NON re-encodee. Le §6.8 prescrit
//                     un `lowpass=f=1200` puis 64 kbit/s -- mais la mesure dit
//                     que le fichier y est deja : f99 a 1050 Hz, et 0,0 % de son
//                     energie au-dessus de 4 kHz. Le filtre ne lui retirerait
//                     rien et le re-encodage lui couterait une generation sur un
//                     materiau qui n'a plus de master.
//
//   ville-interieure  RENOMMEE `lointain-interieur` : la version filtree du
//                     NOUVEAU dehors. Deja mono 64k, f99 a 1561 Hz.
//
// Et deux renommages d'honnetete : Noverre a un restaurant, pas un bar.
//
// LA PISTE QUI PORTE LE SCELLEMENT est `parc-jour`, et c'est mesure : 21 % de
// son energie vit au-dessus de 4 kHz. Le §6.8 avertit qu'une palette sans aigus
// rend le scellement inaudible -- fermer coupe au-dessus de 200 Hz, et s'il n'y
// a rien en haut, fermer ne s'entend pas. C'est l'argument commercial du site.
// Ici les oiseaux le portent. Pour comparaison, `vent` est a 0,1 % et `lointain`
// a 0,0 % : ni l'un ni l'autre ne pourrait tenir ce role.

export const AUDIO_BASE = '/audio';

/**
 * Rognage des points de bouclage.
 *
 * Le code ne s'appuie jamais sur les bornes du tampon decode : le delai
 * d'encodeur MP3 est traite differemment selon les navigateurs et boucler sur
 * la borne produit un clic. On rogne 50 ms de chaque cote.
 *
 * `vent` est la piste a surveiller : 45 s, sous le minimum de 60 a 90 s de la
 * §6.5. C'etait valide sur Parkside PARCE QUE le vent y etait enterre entre -16
 * et -30 sous la ville. Ici la ville est retiree et le lointain est plus discret
 * -- le vent est donc plus expose, et le §6.8 previent explicitement qu'il « va
 * se mettre a boucler ». Son point de bouclage est le premier a verifier a
 * l'oreille, et une prise plus longue serait la vraie reponse.
 */
export const ROGNAGE_BOUCLE = 0.05;

export const PISTES = {
  // --- l'exterieur ---------------------------------------------------------
  /**
   * La foret de jour : oiseaux, insectes, vent leger dans les arbres.
   *
   * SEULE PISTE QUI NE VIENNE PAS DE PARKSIDE, et elle comble un trou reel.
   * `ville-proche` montait la-bas jusqu'a -8 en fin de premiere sequence et y
   * etait l'element exterieur le plus fort de toute la page ; la retirer (§6.8)
   * laissait le lever du jour sans rien -- le jour s'installait et l'on
   * n'entendait plus rien. C'est elle qui prend le relais.
   *
   * C'est aussi ce qu'on entend en sortant des fenetres, et c'est cohérent :
   * le batiment donne sur des arbres, pas sur une rue.
   *
   * Mesure : f99 a 7935 Hz, 8,0 % d'energie au-dessus de 4 kHz. Elle a donc de
   * quoi donner prise au scellement, et elle est gardee a son debit d'origine
   * plutot qu'allegee -- elle est filtree en temps reel, et un filtre revele
   * les defauts d'encodage au lieu de les masquer.
   */
  'foret-jour':         { fichier: 'foret-jour.mp3' },
  'parc-nuit':          { fichier: 'parc-nuit.mp3' },
  'parc-jour':          { fichier: 'parc-jour.mp3' },
  /** Le paysage au loin. `ville-lointaine` de Parkside, renommee : il n'y a
   *  pas de rumeur urbaine ici, et personne ne doit chercher une ville dans le
   *  fichier. */
  'lointain':           { fichier: 'lointain.mp3' },
  /** Le meme dehors, entendu a travers un vitrage. */
  'lointain-interieur': { fichier: 'lointain-interieur.mp3' },
  'vent':               { fichier: 'vent.mp3' },

  // --- les lieux -----------------------------------------------------------
  'spa-bourdon':        { fichier: 'spa-bourdon.mp3' },
  'spa-remous':         { fichier: 'spa-remous.mp3' },
  'piece-sport':        { fichier: 'piece-sport.mp3' },
  'piece-restaurant':   { fichier: 'piece-restaurant.mp3' },
  'musique-velos':      { fichier: 'musique-velos.mp3' },
  'musique-restaurant': { fichier: 'musique-restaurant.mp3' },

  // --- ce qui se pilote a la main ------------------------------------------
  'eau':                { fichier: 'eau.mp3' },
  'rideau':             { fichier: 'rideau.mp3' },

  // --- les deux sons declenches a l'unite ----------------------------------
  'air-seuil':          { fichier: 'air-seuil.mp3', unique: true },
  'hall-cles-pas':      { fichier: 'hall-cles-pas.mp3', unique: true },
};

/**
 * Les deux seuls sons declenches a l'unite de toute la page : la masse d'air du
 * seuil, et l'evenement du hall. Tout le reste tourne en boucle.
 *
 * Ils portent un verrou anti-repetition -- sans lui, un aller-retour au seuil de
 * declenchement produit une mitraillette -- et un `effacer(tau)` pour que leur
 * trainee ne deborde pas sur la scene suivante.
 */
export const UNIQUES = Object.entries(PISTES)
  .filter(([, p]) => p.unique)
  .map(([nom]) => nom);
