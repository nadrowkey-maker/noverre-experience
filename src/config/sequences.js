// LES TREIZE ECRANS — LE SEUL FICHIER DE REGLAGE PAR SEQUENCE.
//
// Tout ce qui se regle a l'oreille ou a l'oeil vit ici : les niveaux de chaque
// couche dans chaque scene, les parts de scellement, les images de
// declenchement, les images fixes du mouvement reduit, les raccords.
// Aucun module de scene ne porte de valeur en dur.
//
// Les constantes de MECANISME -- durees de lissage, plancher des fondus,
// vitesse du defilement -- sont dans constants.js. La regle de partage : si la
// valeur depend de la scene, elle est ici ; si elle gouverne la page entiere,
// elle est la-bas.
//
// Les niveaux sont en decibels, jamais en lineaire, et -60 vaut silence.
//
// LES COURBES DE `couches` VIENNENT DE PARKSIDE, ET NE SONT PAS RETOUCHEES.
//
// Noverre a ete construit pour coller a la timeline sonore de Parkside : meme
// arc de lumiere, memes lieux, dans le meme ordre -- nuit, lever du jour, on
// rentre, hall, spa, velos, ... coucher, nuit. Ces courbes ont ete reglees a
// l'oreille sur plusieurs jours et elles tombent juste sur cette timeline. On
// les copie, on fait tourner, et on ajuste ensuite a l'oreille.
//
// UNE SEULE DIFFERENCE, celle de la §6.8 : le site n'est pas en centre-ville.
// `ville-proche` est RETIREE -- ses evenements identifiables sont ce qui fait
// entendre un centre-ville, et elle ne se baisse pas, elle se retire.
// `ville-lointaine` devient `lointain` et `ville-interieure` devient
// `lointain-interieur`. Rien d'autre ne bouge : c'est un ajustement de palette,
// pas une refonte du mix.
//
// ETAT : les TEXTES sont en attente. Aucun n'est invente ici -- rien qui ne
// soit pas dans le document de sequence ne va devant un client, et une phrase
// inventee sur une piece de reference se remarque plus qu'une phrase absente.
// `titre` et `texte` restent donc vides et sont a remplir avant livraison.

/**
 * Racine des images encodees.
 *
 * A la racine du depot, et non sous public/, pour que le chemin servi soit
 * `/frames/...` comme `/audio/...` -- les deux jeux d'en-tetes de cache visent
 * ces deux motifs, et un site statique sans etape de construction est servi
 * depuis la racine.
 */
const RACINE = '/frames';
export const FRAMES_EXT = 'webp';

let jeuChoisi = null;

/**
 * Choix du jeu d'images, fait UNE FOIS au demarrage.
 *
 * La bande occupe toute la largeur. Le besoin reel en pixels d'appareil est la
 * largeur CSS par le rapport de pixels, plafonne a 2 : au-dela on agrandirait
 * de toute facon, la source ne faisant que 1280. Un iPhone a 390 px CSS demande
 * 780 pixels et recoit le jeu 854, avec 9 % de marge.
 *
 * Mesure sur ce projet : le jeu mobile pese 57 % du bureau alors que sa surface
 * n'en fait que 44 %. Le WebP ne suit pas le compte de pixels, une petite image
 * coute plus cher au pixel. La memoire et le decodage, eux, suivent bien la
 * surface -- 1,56 Mio par image decodee contre 3,52.
 */
export function choisirJeu({ forcerMobile = false } = {}) {
  if (jeuChoisi) return jeuChoisi;
  const rapport = Math.min(window.devicePixelRatio || 1, 2);
  jeuChoisi = (forcerMobile || window.innerWidth * rapport <= 854) ? 854 : 1280;
  return jeuChoisi;
}

export const FRAMES_BASE = () => `${RACINE}/${FRAMES_EXT}-${choisirJeu()}`;

// ---------------------------------------------------------------------------
// L'ECRAN D'ENTREE ET L'ECRAN FINAL
// ---------------------------------------------------------------------------

export const PORTE = {
  id: 'porte',
  // Les deux libelles vivent dans index.html, pas ici : ils sont dans le DOM
  // des le premier octet, donc lisibles par un lecteur d'ecran et indexables,
  // ce qu'un texte injecte par le code ne serait pas au meme moment.
  texte: ['Enter with sound', 'Enter in silence'],
  sousTitre: 'The soundtrack is part of Noverre. It is better with it.',
  // Le son joue DEJA, doucement, sous les deux boutons : les insectes de la
  // nuit. Celui qui choisit le silence les a donc entendus une fois.
  //
  // C'est le meme fichier que la fin de la piscine, a minuit. La page s'ouvre
  // sur eux et se referme sur eux -- et c'est ce qui fait que le parcours est
  // une journee, pas une suite de lieux.
  couches: { 'parc-nuit': -20 },
};

/**
 * LES EMPLACEMENTS EN ATTENTE DU CLIENT.
 *
 * Tant qu'une de ces valeurs vaut null, la ligne qui la porte n'est PAS ecrite
 * a l'ecran -- pas de texte de remplissage, pas de crochets livres. Le jour ou
 * la valeur arrive, la ligne apparait seule et rien d'autre ne bouge.
 *
 * A signaler a la livraison tant qu'elles valent null.
 */
export const TYPOLOGIES = null;      // ex. « Du studio au quatre pieces »
export const SURFACES = null;        // ex. « 32 a 148 m² »
export const PROMOTEUR_NOM = null;   // le nom a afficher sur le lien
export const PROMOTEUR_URL = null;   // la page du projet chez le promoteur

export const FAITS = {
  id: 'faits',
  ecran: 14,
  numero: 14,
  titre: null,
  // Aucune image, du texte sur noir. Aucun son : apres quatre minutes, le
  // silence est la chose la plus forte de la page, et il n'existe que si le
  // bassin s'est vide avant lui.
  //
  // Ce drapeau dit a l'orchestration de ne demander NI anneau, NI source
  // d'images, NI scene sonore pour ce segment. Sans lui, la machinerie irait
  // chercher `frames/webp-1280/faits/0001.webp`, qui n'existe pas et n'a
  // aucune raison d'exister.
  sansImage: true,
  // Trois ecrans : de quoi laisser le noir s'installer, laisser lire, et
  // s'arreter. Plus serait une salle d'attente ; moins ne laisserait pas le
  // silence agir.
  ecrans: 3,
  couches: {},
  lignes: [],                // en attente
  // La cloture. Elle referme l'arche : le parcours est une journee, et la
  // journee recommence. Meme mecanique que les treize autres -- opacite
  // fonction de la position, en bas a gauche, sans deplacement.
  narration: { texte: 'Then it starts again.', a: 0.45, persistant: true },
};

// ---------------------------------------------------------------------------
// LES TREIZE SEGMENTS D'IMAGE
//
// Treize clips, treize segments : contrairement a Parkside, aucune sequence
// n'est coupee en deux.
//
// `frames` est le nombre d'images LIVREES, pas celui du rush. Douze images par
// seconde partout, sauf :
//   05-velos  a 24, parce que les pedales tournent et qu'a 12 les manivelles
//             seraient crantees ;
//   04-spa    a 30, parce que sa source y est et qu'il ne dure que 2,9 s --
//             on garde toutes ses images, il n'y en a deja pas beaucoup.
//
// `ecrans` fixe la distance de defilement, en hauteurs d'ecran. Six par defaut
// (ECRANS_PAR_SEQUENCE), redefini quand la sequence ne fait pas le meme travail
// que les autres.
//
// LES RACCORDS ont ete MESURES, pas decides (tools/mesure-jonctions.py) : on
// compare la derniere image d'un clip a la premiere du suivant, avec pour
// etalon l'ecart entre deux images consecutives du milieu d'un clip -- 7,28.
// Quatre jonctions sortent entre 1,1x et 4,5x l'etalon avec un SSIM de 0,73 a
// 0,98 ; les huit autres entre 5,2x et 12,6x avec un SSIM de -0,05 a 0,48. La
// separation est franche et sans recouvrement. Les quatre premieres sont
// directes et portent `fonduEnchaine: 0`, les autres gardent le fondu par
// defaut.
//
// LA MISE EN ROUTE a ete mesuree de la meme facon : on compare la vitesse de
// fin d'un clip a la vitesse de debut du suivant. Une seule jonction montre un
// vrai saut -- 01 vers 02, a 15,5x. Toutes les autres sont appariees entre
// 0,38x et 2,25x. Une seule sequence porte donc `miseEnRoute`, et en poser
// ailleurs freinerait une camera deja lancee.
// ---------------------------------------------------------------------------

export const SEQUENCES = [
  {
    id: '01-facade', ecran: 1, numero: 1, titre: null, frames: 109,
    texte: [],
    narration: { texte: 'A Tuesday. The last window goes dark at six.',
                 a: 0.40, tenue: 0.22 },
    // Plan quasi fixe : c'est le clip dont deux images consecutives different
    // le moins de tout le parcours. La nuit se retire et les fenetres
    // s'eteignent une a une, la camera ne bouge pas.
    imageFixe: 95,
    // LE LEVER DU JOUR. Les insectes de la nuit se retirent, les oiseaux
    // montent avec une bosse -- ils culminent avant la fin puis se retirent
    // legerement -- et le paysage lointain se reveille par-dessous.
    //
    // Ces valeurs viennent de Parkside et ne sont pas retouchees : elles ont
    // ete reglees a l'oreille sur plusieurs jours, et Noverre a ete construit
    // pour coller a cette timeline. Une seule difference, la transposition de
    // palette de la §6.8 -- `ville-proche`, qui montait ici a -8 en dernier et
    // etait l'element exterieur le plus fort de la page, est RETIREE. Ses
    // evenements identifiables sont ce qui fait entendre un centre-ville.
    //
    // Ce qui porte l'arche a sa place : le jour vers la nuit, qui est deja le
    // sujet du plan -- la nuit se retire pendant que les fenetres s'eteignent.
    couches: {
      'parc-nuit':  { debut: -14, fin: -60 },
      'parc-jour':  { debut: -60, fin: -16, bosse: 0.35, dbBosse: -11 },
      'lointain':   { debut: -60, fin: -14 },
      // LA FORET PREND LE RELAIS DU JOUR, et c'est la place exacte que tenait
      // `ville-proche` sur Parkside : meme courbe, meme retard, meme niveau
      // d'arrivee. Elle y etait l'element exterieur le plus fort de la page.
      //
      // Sans elle, le lever du jour finissait dans le vide : la nuit se
      // retirait, les oiseaux montaient un peu, et une fois le jour installe
      // il ne restait plus rien. C'est ce trou qu'elle comble.
      'foret-jour': { debut: -60, fin: -8, retard: 0.45 },
    },
  },
  {
    id: '02-approche', ecran: 2, numero: 2, titre: null, frames: 109,
    // Cinq et non six : c'est un passage, pas un lieu.
    ecrans: 5,
    texte: [],
    narration: { texte: 'The street is still wet. Nobody is on it yet.',
                 a: 0.35, tenue: 0.20 },
    imageFixe: 55,
    // Raccord DIRECT depuis 01-facade : ecart 32,9 soit 4,5x l'etalon,
    // SSIM 0,734. C'est le plus lache des quatre raccords directs -- la camera
    // a avance entre les deux plans et la facade est plus grosse ici. S'il
    // saute a l'usage, le remede est un fondu tres court, PAS une recherche de
    // meilleure image de raccord : sur la pire jonction de Parkside, une
    // recherche exhaustive 32 x 40 n'a gagne que 1 %.
    fonduEnchaine: 0,
    // La SEULE mise en route du parcours, et elle est mesuree : la facade est
    // immobile (vitesse de fin 0,35) et l'approche demarre a 5,46, soit un
    // saut de 15,5x. Sans elle, la camera partirait d'un coup a pleine vitesse
    // au franchissement. Les douze autres jonctions sont appariees et n'en
    // veulent pas.
    miseEnRoute: 0.12,
    // LE SEUIL. On entre dans le batiment, et l'ecran s'eteint entierement
    // avant qu'on ne se reveille a l'interieur. Ce n'est pas un raccord : c'est
    // le franchissement, le seul moment du parcours ou l'on passe du dehors au
    // dedans, et il doit se sentir.
    //
    // La descente est plus longue que celle du spa -- 0,28 contre 0,22 -- et sa
    // tenue plus longue aussi, 0,12 contre 0,08. Les deux noirs du parcours ne
    // disent pas la meme chose : celui du spa separe deux lieux, celui-ci fait
    // entrer. Le second doit donc durer davantage.
    extinctionSortie: { part: 0.28, plancher: 0, tenue: 0.12 },
    // La rue se resserre et se ferme. Un seul mouvement d'air grave au moment
    // ou la lumiere meurt. Valeurs de Parkside, `ville-proche` retiree (§6.8).
    couches: {
      'parc-jour':  { debut: -16, fin: -40 },
      'lointain':   { debut: -14, fin: -26 },
      // La foret arrive de la facade a plein niveau, puis la rue se resserre et
      // se ferme a mesure qu'on approche de la porte. Courbe de `ville-proche`
      // sur Parkside, a l'identique.
      'foret-jour': { debut: -8, fin: -34 },
    },
    declencheurs: [
      // Au seuil exact ou la lumiere meurt. Parkside le posait a l'image 150
      // sur 181, soit 83 % du segment ; ici 90 sur 109, la meme part. Il tombe
      // donc au milieu de l'extinction, pas avant ni apres.
      //
      // Verrou anti-repetition : il ne repart pas si le visiteur remonte puis
      // redescend. Sans lui, un aller-retour au seuil produit une mitraillette.
      { a: 90, son: 'air-seuil', db: -10 },
    ],
  },
  {
    id: '03-hall', ecran: 3, numero: 3, titre: null, frames: 109,
    texte: [],
    narration: { texte: 'The door closes. The city stops at it.',
                 a: 0.55, tenue: 0.20 },
    imageFixe: 60,
    // On se REVEILLE a l'interieur : on sort du noir tenu de l'approche. Sans
    // rallumage, l'image sombre du hall apparaitrait d'un coup sur le noir --
    // une marche visible, alors que la piece est censee revenir de
    // l'obscurite. Le rallumage se superpose a la lumiere deja presente dans le
    // rush, il ne la remplace pas.
    allumageEntree: { part: 0.10, plancher: 0 },
    // Et le fondu enchaine doit sauter, sinon on rallume TOUT EN FONDANT : la
    // derniere image de l'approche remonterait en opacite par-dessus le noir
    // qui remonte, deux mouvements contradictoires. C'est le piege 14, et il
    // demande les trois ensemble.
    fonduEnchaine: 0,
    // C'EST ICI QUE LE SCELLEMENT SE PRODUIT, et c'est l'argument commercial du
    // site : le dehors s'arrete a la porte. Le passe-bas se referme en 0,2 s de
    // 18 kHz a 200 Hz, le volume met 0,65 s a rejoindre le niveau interieur, et
    // pendant ce decalage il ne reste qu'une masse grave sans detail, encore
    // forte, qui s'efface. C'est ca, une porte qui se referme.
    //
    // Il porte sur `parc-jour` seul, et non sur le couple de Parkside : la
    // ville proche est retiree (§6.8), et le parc est justement ce qui a des
    // aigus a couper -- 21 % de son energie au-dessus de 4 kHz, mesure. Le §6.8
    // le dit : une fenetre qui coupe le chant des oiseaux se ressent mieux
    // qu'une fenetre qui coupe la circulation.
    scellement: {
      // Le reglage le plus discutable de la scene : trop tot il finit avant que
      // la piece soit lisible, trop tard on entend le dehors dans un hall deja
      // visible.
      part: 0.18,
      dbOuvert: -8,
      dbFerme: -34,
      // Les DEUX pistes a aigus du jeu, et c'est ce qui donne prise au
      // scellement : `parc-jour` a 21 % d'energie au-dessus de 4 kHz,
      // `foret-jour` a 8 %. Fermer coupe au-dessus de 200 Hz -- s'il n'y avait
      // rien en haut, fermer ne s'entendrait pas.
      pistes: ['foret-jour', 'parc-jour'],
    },
    couches: {
      // LE HALL S'ENTEND TOUT DE SUITE. Il montait de -60 a -28 sur tout le
      // segment, ce qui le laissait quasi muet pendant le premier tiers : on
      // entrait dans une piece sans rien entendre, et l'ambiance n'arrivait
      // qu'une fois qu'on en sortait presque.
      //
      // Elle part maintenant a un niveau deja audible et ne fait plus que se
      // poser. C'est le dehors entendu a travers le vitrage : il est la des
      // qu'on est dans le hall, puisque le hall est vitre.
      'lointain-interieur': { debut: -34, fin: -28 },
    },
    declencheurs: [
      // Les cles qu'on pose, puis les pas qui s'eloignent. Seule signature
      // sonore de toute la page.
      //
      // A L'IMAGE 10, ET NON 35. Parkside la posait a 32 % de son segment,
      // mais son hall etait deux fois plus long en distance de defilement : a
      // la meme part, on entrait ici dans le hall et l'on attendait avant que
      // quoi que ce soit ne se passe.
      //
      // Tres tot dans le plan, donc, et c'est doublement voulu : le fichier
      // dure 7,4 s dont 6,9 de trainee, et les pas s'y eloignent longtemps.
      // Declenche tard, ils marcheraient encore dans le spa -- or c'est la
      // scene qui doit etre la plus silencieuse de la page. Ce qui compte n'est
      // pas le son, c'est ce qui revient apres lui.
      { a: 10, son: 'hall-cles-pas', db: -15 },
    ],
  },
  {
    id: '04-spa', ecran: 4, numero: 4, titre: null, frames: 86,
    // Cinq ecrans. Il en a porte huit -- le spa est le creux de la page et il
    // n'existe que s'il dure -- mais a l'usage il fallait trop defiler pour le
    // traverser : le plan est quasi immobile, donc la duree ne se lisait pas
    // comme du calme, elle se lisait comme une attente.
    //
    // Rien ne s'y oppose du cote de la finesse. Elle ne se juge pas en pixels
    // par image mais en mouvement par pixel de defilement : a huit ecrans le
    // spa sortait deja a 0,011, vingt fois plus lisse que l'approche a 0,232,
    // et le raccourcir ne fait que le rendre plus fin encore. Le clip est court
    // -- 2,9 s contre 9 s pour les autres -- mais il est aussi le plus
    // immobile, et c'est ce qui compte.
    //
    // La sortie reste large : l'extinction et sa tenue occupent 30 % du
    // segment, soit un ecran et demi, ce qui laisse le noir s'installer.
    ecrans: 5,
    texte: [],
    // La premiere moitie d'une phrase coupee en deux par le noir. La seconde
    // est sur les velos, de l'autre cote. Voir la narration de 05.
    narration: { texte: 'Down here, the day has not started yet.',
                 a: 0.30, tenue: 0.26 },
    imageFixe: 40,
    // L'EXTINCTION, et c'est un evenement, pas un raccord. Le spa est sourd,
    // humide et immobile ; la salle de velos est seche, sombre et rythmee. Un
    // raccord franc entre les deux se lirait comme une erreur de montage. On
    // eteint donc entierement, on TIENT le noir, puis 05 se rallume.
    //
    // La `tenue` est ce qui fait la difference entre une transition et un
    // evenement : sans elle, l'extinction atteint le noir exactement a la
    // derniere image et l'on n'y reste pas.
    //
    // Le rush ne finit PAS au noir -- verifie sur sa derniere image, le bassin
    // y est encore eclaire. Le noir est donc entierement produit ici.
    extinctionSortie: { part: 0.22, plancher: 0, tenue: 0.08 },
    // DEUX COUCHES, ET PAS TROIS. Aucune musique, aucune reverberation, rien de
    // l'exterieur : la piece n'a aucune ouverture. Le test, unique dans toute la
    // page : ecouter quinze secondes et s'ennuyer.
    //
    // C'est aussi pourquoi le spa s'eteint avant les velos. Sans cela le
    // morceau arriverait par-dessus le silence du creux et agresserait
    // l'oreille : c'est le seul endroit de la page ou une scene passe du vide
    // absolu a la musique. On eteint l'image, et la musique demarre dans le
    // noir.
    // PLUS CALME QUE SUR PARKSIDE, et les bulles nettement plus en retrait.
    //
    // Le bourdon descend de -17 a -22, les remous de -25 a -34. Le spa est le
    // CREUX de la page : c'est le seul endroit ou le test est d'ecouter quinze
    // secondes et de s'ennuyer. Des bulles qu'on suit sont des bulles trop
    // fortes -- elles donnent quelque chose a ecouter, exactement ce que cette
    // scene ne doit pas faire.
    //
    // Le bourdon reste le sujet : c'est lui qui dit que la piece est fermee,
    // humide et sourde. Les remous ne sont plus qu'un signe de vie dessous.
    couches: {
      'spa-bourdon': { debut: -22, fin: -22 },
      'spa-remous':  { debut: -34, fin: -34 },
    },
  },
  {
    id: '05-velos', ecran: 5, numero: 5, titre: null, frames: 217,
    texte: [],
    // TRES TOT, A 0,12, ET C'EST LA RAISON D'ETRE DE CETTE LIGNE.
    //
    // Elle repond a celle du spa a travers le raccord au noir : « Down here,
    // the day has not started yet. » puis, de l'autre cote du noir, « And then
    // it does, all at once. » C'est UNE SEULE PHRASE coupee en deux par un
    // changement de lieu, et c'est ce qui transforme treize plans en un recit.
    //
    // Si elle arrivait tard, la phrase ne se refermerait pas et l'effet serait
    // perdu. Ne pas la deplacer.
    narration: { texte: 'And then it does, all at once.',
                 a: 0.12, tenue: 0.20 },
    imageFixe: 120,
    // Le RALLUMAGE, l'autre moitie de l'extinction du spa. Les trois vont
    // ensemble et n'en poser que deux est le piege 14 : une extinction sans
    // rallumage laisse le segment suivant en plein noir, et un rallumage sans
    // `fonduEnchaine: 0` fait remonter l'image precedente en fondu par-dessus
    // le noir qui remonte -- deux mouvements contradictoires.
    allumageEntree: { part: 0.14, plancher: 0 },
    fonduEnchaine: 0,
    // `musique-velos` N'EST PAS une couche de cette scene, et c'est essentiel :
    // une couche est coupee a la frontiere par `taire()`, et la pente des trois
    // salles s'appliquerait alors au silence. Le morceau est une piste CONTINUE
    // sur trois sequences, possedee par la chaine (audio/behaviours/velos.js).
    // Sa tete de lecture ne repart ni ne s'arrete entre l'entree dans la salle
    // de velos et la fin du yoga : seuls son volume et son filtre changent.
    // C'est ce qui fait de la chute du maximum au minimum un SEUL geste.
    couches: {},
    // Seul endroit de la page qui obeisse a la VITESSE du defilement : scroll
    // lent, le morceau s'entend comme a travers une porte fermee ; scroll
    // rapide, le filtre s'ouvre. C'est un jeu, pas un gain vole a la regle.
    velos: {
      // Image a laquelle le morceau arrive en entier quelle que soit la
      // vitesse. Parkside : 320 sur 361, soit 89 % du segment ; ici 192 sur
      // 217, la meme part. Cette recompense ne se reprend pas.
      imageRecompense: 192,
      // Le morceau part de zero DANS LE NOIR et monte avec le defilement sur la
      // premiere part du segment, en meme temps que l'image se rallume.
      montee: 0.14,
      // Pas de niveau propre : le morceau joue a MUR_DB_DEBUT, le meme niveau
      // qu'a l'entree de la salle de sport. C'est ce qui garantit qu'il n'y a
      // aucune marche a la frontiere.
    },
  },
  {
    id: '06-salle-sport', ecran: 6, numero: 6, titre: null, frames: 109,
    texte: [],
    narration: { texte: 'Outside, the park is having its own morning.',
                 a: 0.45, tenue: 0.20 },
    imageFixe: 60,
    // De l'entree dans la salle de sport jusqu'a la fin du yoga, une SEULE
    // valeur -- la distance a la salle de velos -- va de 0 a 1. Deux parametres
    // la suivent, le volume et la coupure. La salle de yoga n'a donc aucun
    // fichier propre : elle est la fin de la courbe.
    couches: { 'piece-sport': { debut: -2, fin: -5 } },
    distanceVelos: { debut: 0.0, fin: 0.5 },
    // La camera sort par le vitrage : ce segment participe a l'EXCURSION du
    // jardin. Les seuils vivent dans FACADE, sur un axe d'images global -- une
    // excursion qui enjambe deux segments a besoin d'un axe monotone.
    traversee: true,
  },
  {
    id: '07-yoga', ecran: 7, numero: 7, titre: null, frames: 109,
    texte: [],
    narration: { texte: 'Nothing happens in this room. That is the point.',
                 a: 0.40, tenue: 0.26 },
    imageFixe: 85,
    // Raccord DIRECT depuis 06-salle-sport : ecart 11,1 soit 1,5x l'etalon,
    // SSIM 0,962. La camera sort par le vitrage et continue dehors.
    fonduEnchaine: 0,
    // La fin de la pente des trois salles. La borne depasse 1 : la valeur est
    // bornee a 1 dans scene.js, donc le silence est atteint a mi-parcours du
    // segment et s'y TIENT. Ca reste UNE seule pente monotone, sans cas
    // particulier.
    couches: { 'piece-sport': { debut: -5, fin: -60 } },
    distanceVelos: { debut: 0.5, fin: 1.5 },
    // La camera rentre dans le batiment : fin de l'EXCURSION du jardin.
    //
    // `lointain-interieur` n'est PAS une couche ici, et c'est le piege 1 de la
    // §6.7 : le comportement de traversee la possede. Le melangeur generique
    // tourne AVANT les comportements et la remettrait a son niveau a chaque
    // trame -- impossible alors de la couper pendant qu'on est dehors, ni de la
    // faire revenir au retour. C'est un piege d'ordre d'execution, et il est
    // silencieux : tout a l'air branche, rien ne marche.
    traversee: true,
  },
  {
    id: '08-salon', ecran: 8, numero: 8, titre: null, frames: 109,
    texte: [],
    narration: { texte: 'Eleven o\'clock, and somebody opens the curtain.',
                 a: 0.20, tenue: 0.22 },
    imageFixe: 90,
    // Une seule couche : le dehors entendu de l'interieur, au seuil de
    // l'audible. La baie ne s'ouvre pas, donc l'air ne bouge pas non plus. Le
    // silence de l'appartement est le SUJET : il n'a pas besoin d'etre
    // fabrique, il a besoin d'etre laisse tranquille.
    couches: { 'lointain-interieur': { debut: -36, fin: -36 } },
    // LE RIDEAU. Sa boucle tourne en permanence et seul son VOLUME suit la
    // valeur ABSOLUE de sa vitesse -- jamais sa position. Montee douce,
    // extinction franche en 50 ms : un rideau qui s'arrete s'arrete.
    //
    // Parkside le posait entre les images 30 et 150 sur 181, soit de 17 % a
    // 83 % du segment ; ici 18 et 90 sur 109, les memes parts.
    rideau: {
      de: 18, a: 90,
      db: -18,
      // Un rideau epais absorbe les aigus : le dehors peut monter de deux ou
      // trois decibels pendant l'ouverture, pas plus. Personne ne le remarquera,
      // tout le monde sentira que la piece s'ouvre en meme temps que la lumiere
      // entre.
      pisteDehors: 'lointain-interieur',
      dbDehors: -36,
      dbDehorsOuvert: -33,
    },
  },
  {
    id: '09-chambre', ecran: 9, numero: 9, titre: null, frames: 109,
    texte: [],
    narration: { texte: 'The bed stays unmade until the afternoon. Nobody minds.',
                 a: 0.45, tenue: 0.22 },
    imageFixe: 50,
    // La chambre ne sort PAS du batiment -- c'est un travelling au ras du lit,
    // il finit sur la matiere. Elle n'a donc pas de traversee, contrairement a
    // son homologue de Parkside qui, elle, franchissait la vitre.
    //
    // Une seule couche, au seuil de l'audible : c'est la piece la plus
    // silencieuse apres le spa, et son silence est ce qu'elle demontre.
    couches: { 'lointain-interieur': { debut: -36, fin: -36 } },
  },
  {
    id: '10-balcon', ecran: 10, numero: 10, titre: null, frames: 109,
    texte: [],
    narration: { texte: 'By four, the trees are doing most of the talking.',
                 a: 0.35, tenue: 0.20 },
    imageFixe: 70,
    // On sort par la baie : debut de l'EXCURSION du parc. Comme en 07, les
    // pistes exterieures ne sont PAS des couches ici -- le comportement les
    // possede, sans quoi le melangeur les remettrait a leur niveau a chaque
    // trame et le franchissement ne s'entendrait pas.
    //
    // Une nuance qui se voit a l'image : la baie est OUVERTE, ce sont des
    // coulissants ecartes et non une vitre a franchir. Le mecanisme reste le
    // bon -- c'est le plan de facade qui compte -- mais l'ecart entre dedans et
    // dehors est plus faible ici qu'a une fenetre fermee. A regler a l'oreille.
    couches: {},
    traversee: true,
  },
  {
    id: '11-montee-toit', ecran: 11, numero: 11, titre: null, frames: 109,
    texte: [],
    narration: { texte: 'The building keeps going after the apartments stop.',
                 a: 0.30, tenue: 0.20 },
    imageFixe: 55,
    // Raccord DIRECT depuis 10-balcon : ecart 16,4 soit 2,3x l'etalon,
    // SSIM 0,882. La camera passe au-dessus de la balustrade et monte.
    fonduEnchaine: 0,
    // La camera monte le long de la facade puis entre dans le restaurant : fin
    // de l'EXCURSION du parc. C'est le seul des quatre franchissements qui
    // referme sur une VRAIE vitre -- le restaurant est entierement vitre --
    // donc c'est celui ou le scellement a le plus a demontrer.
    couches: {},
    traversee: true,
  },
  {
    id: '12-restaurant', ecran: 12, numero: 12, titre: null, frames: 109,
    texte: [],
    narration: { texte: 'The lamps come on before the sky admits it is evening.',
                 a: 0.40, tenue: 0.22 },
    imageFixe: 60,
    // Raccord DIRECT depuis 11-montee-toit : ecart 8,1 soit 1,1x l'etalon,
    // SSIM 0,982. C'est le plus serre des quatre -- au niveau de deux images
    // consecutives a l'interieur d'un meme clip.
    fonduEnchaine: 0,
    // Premier lieu habite depuis le hall. Le vent y entre discretement : pas
    // pour faire sentir la hauteur, mais pour annoncer que le batiment se
    // rouvre. Une salle vitree est abritee, donc nettement moins que sur le
    // toit -- sinon la piscine n'aurait plus rien a donner.
    //
    // Le parc est joue et entierement masque par la musique et les voix : a la
    // piscine on retire les deux, et il reapparait sans qu'on ait touche a son
    // volume. Valeurs de Parkside, ou les deux segments du bar portaient
    // -30 puis -30 -> -28 sur le vent ; fondus ici en une seule pente.
    couches: {
      'musique-restaurant': { debut: -19, fin: -19 },
      'piece-restaurant':   { debut: -8,  fin: -8 },
      'vent':               { debut: -30, fin: -28 },
      'parc-jour':          { debut: -24, fin: -24 },
    },
  },
  {
    id: '13-piscine', ecran: 13, numero: 13, titre: null, frames: 133,
    // Douze ecrans : le seul ecran construit pour RETENIR quelqu'un plutot que
    // pour le faire avancer. L'eau repond au curseur et au doigt, et elle
    // continue de bouger quand le defilement s'est arrete.
    ecrans: 12,
    texte: [],
    // ELLE NE DISPARAIT PAS, et c'est ce qui la distingue des douze autres.
    //
    // Elle monte a 0,45 et reste jusqu'a la fin du segment. Ce n'est pas une
    // legende, c'est une CONSIGNE : elle apprend au visiteur que l'eau repond a
    // sa main, sans aucune indication d'interface. Elle doit donc rester
    // lisible tant qu'il joue avec l'eau -- et c'est justement l'ecran construit
    // pour le retenir.
    narration: { texte: 'The water is still warm. Put your hand in it.',
                 a: 0.45, persistant: true },
    imageFixe: 30,
    // LA PREMIERE SEQUENCE A L'ENVERS, et c'est ce qui referme la page. La-bas
    // le parc seul se faisait recouvrir par le lointain qui montait ; ici le
    // lointain se retire et le parc reapparait. C'est le meme mouvement.
    //
    // Deux differences dues a la hauteur : le vent est present d'un bout a
    // l'autre, et c'est la seule chose stable du plan.
    couches: {
      // LA FORET TIENT LA PART DE JOUR, et se retire avec elle. Meme forme que
      // les oiseaux -- une bosse puis un retrait -- mais un cran plus fort,
      // parce que c'est elle la voix du dehors depuis que la ville est partie.
      // Elle meurt franchement : une foret de jour dans une scene de nuit
      // s'entendrait tout de suite comme une erreur.
      'foret-jour': { debut: -20, fin: -60, bosse: 0.40, dbBosse: -11 },
      // Dernier son du site.
      'lointain':  { debut: -12, fin: -30 },
      // Les oiseaux montent a mesure que le lointain se retire, PUIS CEDENT LA
      // PLACE AUX INSECTES quand la nuit tombe. Ils ne restent pas : les
      // oiseaux ne chantent pas la nuit, et les laisser tenir jusqu'au bout
      // faisait sonner la nuit faux.
      'parc-jour': { debut: -24, fin: -60, bosse: 0.40, dbBosse: -13 },
      // Exactement les insectes du tout premier ecran, LE MEME FICHIER. La page
      // s'ouvre sur eux a l'aube et se referme sur eux a minuit. Croisement
      // lent, sur toute la descente.
      'parc-nuit': { debut: -60, fin: -17, retard: 0.42 },
      'vent':      { debut: -16, fin: -16 },
    },
    // « Il se tait avant le lointain » : a la toute fin les insectes
    // s'eteignent et il ne reste que le paysage, tres loin, sous le vent. Ce
    // n'est pas physiquement exact -- une nuit de septembre est pleine
    // d'insectes -- c'est une decision de composition : elle prepare l'ecran
    // suivant, du texte sur noir dans le silence total.
    tairAvantLaVille: { de: 0.88, dbFin: -60 },
    // Le bassin en WebGL. Seul endroit du site qui n'est pas un canvas 2D.
    // L'eau est aussi le seul son de la page pilote par LA MAIN et non par le
    // defilement, et le seul dont le gain est lineaire.
    eau: true,
  },
];

/**
 * Le decalage de chaque segment sur l'axe d'images GLOBAL.
 *
 * Une excursion hors du batiment enjambe deux segments -- on sort en 06 et l'on
 * ne rentre qu'en 07 -- alors que l'index d'image repart a zero a chaque
 * frontiere. Sur cet axe-la, une excursion garde un intervalle monotone.
 */
const DECALAGES = (() => {
  const m = {};
  let n = 0;
  for (const s of SEQUENCES) { m[s.id] = n; n += s.frames; }
  return m;
})();

export const imageGlobale = (id, image) => (DECALAGES[id] ?? 0) + image;

/**
 * LES TRAVERSEES DE FACADE — une seule instance, deux couples de seuils.
 *
 * Noverre sort deux fois du batiment, la ou Parkside ne sortait qu'une. Deux
 * instances separees tomberaient dans le piege de la §6.7 : la banque ne route
 * une piste vers un filtre qu'A SA CREATION, donc la seconde traversee
 * recupererait `parc-jour` deja branche sur le filtre de la premiere, et son
 * scellement n'aurait aucun effet. Symptome : une des deux fenetres ne s'entend
 * pas se fermer, et ca se diagnostique tres mal a l'oreille.
 *
 * La §6.7 donne la parade en premier : « une seule instance partagee, et
 * donnez-lui deux couples de seuils ». Les deux excursions partagent le meme
 * paysage et surtout la meme piste a aigus -- `parc-jour` est la seule du jeu
 * qui ait de quoi mordre au scellement -- donc elles ne PEUVENT pas avoir deux
 * filtres.
 *
 * LES SEUILS SONT RELEVES A L'OEIL, sur l'image, jamais calcules depuis le
 * minutage. Le critere de la §6.7 : « plus aucun montant de menuiserie dans le
 * cadre ». Sur Parkside le calcul donnait 42 et l'oeil donnait 68 ; c'est l'oeil
 * qui avait raison.
 */
export const IMAGE_SORTIE_JARDIN = 96;   // 06-salle-sport : plus un reflet de vitre
export const IMAGE_RETOUR_JARDIN = 60;   // 07-yoga : le sol de la salle prend le bas
export const IMAGE_SORTIE_PARC   = 26;   // 10-balcon : le mobilier quitte le cadre
export const IMAGE_RETOUR_PARC   = 80;   // 11-montee-toit : on passe le vitrage

export const FACADE = {
  // Ce qu'on entend UNE FOIS DEHORS, a plein niveau. Valeurs de Parkside, ou
  // `ville-lointaine` tenait la place de `lointain`.
  //
  // Choisi selon la HAUTEUR : depuis un etage on n'entend pas une rue en
  // detail, ni pas, ni portieres, ni voix, seulement une masse diffuse et
  // essentiellement grave. C'est aussi pourquoi l'equivalent de `ville-proche`
  // n'y figure pas -- il n'existe plus du tout dans cette palette (§6.8).
  dehors: {
    // La voix du dehors, et de loin la plus presente : c'est sur des arbres que
    // ce batiment donne, pas sur une rue.
    'foret-jour': -8,
    'lointain':   -14,
    'parc-jour':  -16,
    'vent':       -18,
  },
  // Le niveau de ces MEMES pistes tant qu'on est derriere la facade. Elles y
  // sont PLATES : le franchissement est un evenement a une image, pas une
  // courbe sur le segment. Une courbe les ferait monter avant l'evenement, et
  // l'on entendrait les oiseaux a travers le verre.
  dbDehorsAvant: -60,
  dbDedans: -46,
  // Ce qui reste une fois la piece refermee. Sans elle la demi-seconde de
  // fermeture ne mene nulle part : on refermerait sur du vide au lieu de
  // refermer sur une piece. C'est elle qui dit qu'il y a encore un monde dehors.
  pisteInterieure: 'lointain-interieur',
  dbInterieure: -36,
  /**
   * De combien le dehors est attenue au DEBUT d'une approche, en decibels.
   *
   * Seize : il est deja franchement la, mais il lui reste un cran a gagner au
   * franchissement. Si l'ecart etait plus faible, passer le plan de facade ne
   * s'entendrait pas ; s'il etait plus grand, la baie n'aurait pas l'air
   * ouverte.
   */
  approcheAttenuation: 16,
  passages: [
    // LE VITRAGE DE LA SALLE DE SPORT : une vitre, donc un evenement a une
    // image. Rien ne passe tant qu'on est derriere le verre.
    { sortie: imageGlobale('06-salle-sport', IMAGE_SORTIE_JARDIN),
      retour: imageGlobale('07-yoga', IMAGE_RETOUR_JARDIN) },
    // LA BAIE DU BALCON : elle est DEJA OUVERTE -- ce sont des coulissants
    // ecartes, on le voit a l'image des la premiere. Le dehors entre donc deja,
    // attenue, et monte a mesure qu'on s'en approche ; le franchissement lui
    // donne le dernier cran au lieu de tout donner d'un coup.
    //
    // La traiter comme une vitre serait faux dans les deux sens : on verrait
    // une baie ouverte sans rien entendre, puis tout arriverait d'un bloc sur
    // un seuil que rien ne materialise.
    //
    // L'approche part de la PREMIERE image du segment : le salon est derriere
    // nous, la baie est deja dans le cadre.
    { sortie: imageGlobale('10-balcon', IMAGE_SORTIE_PARC),
      retour: imageGlobale('11-montee-toit', IMAGE_RETOUR_PARC),
      approche: { de: imageGlobale('10-balcon', 1) } },
  ],
};

/** Premier et dernier segment d'image : sert aux fondus de bord de page. */
export const premiere = (s) => s === SEQUENCES[0];
export const derniere = (s) => s === SEQUENCES[SEQUENCES.length - 1];
