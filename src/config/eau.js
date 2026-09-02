// Les constantes du bassin.
//
// Deux familles, et il ne faut pas les confondre.
//
// LA SIMULATION se recopie A LA VALEUR PRES du projet d'origine, ou chaque
// constante a ete reglee a la main contre l'oeil sur plusieurs jours. Aucune ne
// se devine, aucune ne s'arrondit : les changer revient a refaire ce reglage,
// pas a ajuster un parametre.
//
// L'ECLAIRAGE, lui, est propre a CETTE piscine et a ete remesure sur ses 133
// images. Reprendre celui de Parkside serait poser le soleil d'un autre
// batiment sur celui-ci.

/** Cote de la grille de simulation. */
export const RESOLUTION = 256;

/** Pas de temps fixe, et nombre de pas joues par trame. */
export const PAS = 1 / 60;
export const PAS_PAR_CADRE = 2;
/** Rattrapage borne : au-dela, on laisse filer plutot que de s'enfoncer. */
export const MAX_SOUS_PAS = 3;

/** La goutte du pointeur. */
export const GOUTTE_RAYON = 0.03;
export const GOUTTE_BASE = 0.004;
export const GOUTTE_AMPLITUDE = 0.016;

/** Vitesse du pointeur, en pixels par trame, a laquelle tout est a fond. */
export const VITESSE_PLEINE = 30;
/** Lissage de cette vitesse. */
export const LISSAGE_VITESSE = 0.12;

/** Le clic : une goutte plus forte et plus large. */
export const CLIC_FORCE = 0.05;
export const CLIC_RAYON = 0.05;

/** L'amorcage : vingt gouttes alternees, pour que l'eau ne soit jamais plate. */
export const AMORCE_NOMBRE = 20;
export const AMORCE_FORCE = 0.01;

/** Bornage de la file : au-dela, la goutte est perdue, et c'est la bonne perte. */
export const MAX_GOUTTES_PAR_CADRE = 4;

/**
 * LES GOUTTES AMBIANTES.
 *
 * Ce sont elles qui font que l'eau reste vivante quand personne ne la touche,
 * et c'est exactement ce que cet ecran exige : il est construit pour RETENIR
 * quelqu'un, et l'eau doit continuer de bouger quand le defilement s'est
 * arrete. Sans elles la surface se fige des qu'on lache la souris, et l'ecran
 * redevient une image.
 *
 * Trois sources qui derivent lentement, une goutte toutes les 1,6 seconde
 * environ, et trois fois moins fortes tant que le visiteur touche encore l'eau
 * -- sinon les siennes seraient noyees dans la pluie de fond.
 */
export const AMBIANT_NOMBRE = 3;
export const AMBIANT_FORCE = 0.0055;
export const AMBIANT_RAYON = 0.035;
export const AMBIANT_PERIODE = 1.6;
export const AMBIANT_MULT_ACTIF = 0.35;
/** Delai sans interaction au-dela duquel la pluie de fond reprend sa pleine force. */
export const INACTIF = 2.2;

// --- Le rendu de la surface --------------------------------------------------

/**
 * Amplitude du decalage d'echantillonnage de la plaque, en unites d'UV.
 *
 * DIMENSIONNEE PAR LA MESURE, et non a vue. Les pentes de la houle au repos
 * valent 0,013 a la mediane et 0,075 au maximum. A 0,012 -- la premiere valeur
 * essayee sur Parkside -- cela donnait 0,2 pixel de deplacement median et 1,1
 * au maximum, c'est-a-dire rien du tout : l'eau restait une photographie, et
 * l'on doutait que la simulation tourne.
 *
 * A 0,07 la houle de fond deplace 1,2 pixel a la mediane et 6 au maximum, et le
 * sillage du doigt, bien plus raide, atteint la quinzaine.
 */
export const REFRACTION = 0.07;

/**
 * Raidissement de la normale, POUR LE SEUL ECLAT.
 *
 * La simulation porte la houle, pas la ride. Ses pentes plafonnent a 4 degres,
 * quand le miroitement d'un vrai bassin nait de rides capillaires bien plus
 * raides et bien plus fines que la grille de 256 ne peut en representer.
 *
 * Sans ce facteur, la normale n'atteint jamais l'inclinaison qu'il faudrait
 * pour renvoyer une lumiere et le lobe speculaire ne s'allume litteralement
 * jamais -- on paie le calcul et on ne voit rien.
 *
 * Il ne touche PAS la refraction : la ride capillaire fait scintiller, elle ne
 * deplace pas le fond du bassin.
 */
export const AMPLI_PENTE = 4.0;

/**
 * LE SOLEIL : ETEINT, ET C'EST UNE MESURE, PAS UN OUBLI.
 *
 * La passation prevoit les deux cas : « si le nouveau plan a un soleil visible,
 * refaites cette mesure ; s'il n'en a pas, mettez ECLAT_SOLEIL a zero partout
 * et ne gardez que le terme nocturne ». C'est le second cas.
 *
 * Verifie en cartographiant `rouge moins bleu` sur les 133 images : a
 * l'interieur du quadrilatere, l'eau ne porte AUCUNE trainee chaude, a aucun
 * instant du plan. Le soleil est hors cadre, bas et a gauche, et l'eau ne
 * reflete que la vegetation et le ciel. Une premiere mesure automatique avait
 * bien trouve un signal chaud culminant en fin de plan -- mais il venait des
 * lampes de la terrasse refletees au bord du bassin, pas d'un soleil : sur la
 * carte, l'interieur du bassin reste vert-neutre puis bleu du debut a la fin.
 *
 * Poser un lobe speculaire ici reviendrait a peindre une lumiere qui n'est pas
 * dans la photographie, ce qui est exactement ce que ce moteur refuse de faire.
 */
export const ECLAT_SOLEIL = [[0.0, 0.0], [1.0, 0.0]];

/**
 * Le miroitement du soleil : INERTE, puisque ECLAT_SOLEIL est nul partout.
 *
 * Les valeurs sont neutres et n'ont aucun effet -- elles ne servent qu'a
 * donner une valeur definie aux uniformes. Si un plan avec soleil visible
 * arrive un jour, c'est ici que la mesure de la §7.5 se colle.
 *
 * Par ligne : t, centre u, centre v, etendue en u, etendue en v.
 */
export const MIROITEMENT = [
  [0.000, 0.500, 0.500, 0.250, 0.250],
  [1.000, 0.500, 0.500, 0.250, 0.250],
];

/**
 * LES PROJECTEURS IMMERGES — mesures, et c'est le seul eclat de ce plan.
 *
 * LE SIGNAL. Ni `bleu moins rouge` ni la luminance brute ne conviennent : au
 * crepuscule TOUTE la scene devient bleue, et la luminance du bassin baisse en
 * meme temps que le jour. Le signal juste est le RAPPORT entre la luminance du
 * bassin et celle de la terrasse qui l'entoure -- il dit litteralement « le
 * bassin s'eclaire-t-il de l'interieur ? » et il est insensible au niveau
 * general de lumiere.
 *
 * CE QU'IL DONNE, mesure sur les 133 images :
 *
 *   t = 0,00 a 0,36   rapport 1,21 a 1,37   le bassin est naturellement un peu
 *                                           plus clair que la terrasse : il
 *                                           reflete le ciel.
 *   t = 0,50          rapport 0,997         le creux. Plus de ciel a refleter,
 *                                           pas encore de projecteurs. C'est le
 *                                           zero de la courbe.
 *   t = 0,55 a 0,86   rapport 1,07 -> 2,24  les projecteurs montent.
 *   t = 0,86 a 1,00   rapport 2,24 -> 2,00  ils ne baissent PAS : c'est la
 *                                           terrasse qui s'eclaire (ses lampes
 *                                           passent de 40,6 a 44,4) pendant que
 *                                           la luminance du bassin reste a 90.
 *                                           La courbe est donc TENUE a 1 apres
 *                                           son maximum plutot que de suivre un
 *                                           artefact du denominateur.
 *
 * Le relais tombe presque exactement la ou celui de Parkside avait ete mesure
 * -- 0,52 a 0,83 la-bas, 0,52 a 0,86 ici -- ce qui est rassurant : deux plans
 * differents, deux mesures independantes, la meme heure.
 *
 * Cet eclat n'est ni dirige ni canalise : une lumiere qui vient d'en dessous
 * scintille partout a la fois, pas dans une trainee. Il ignore donc
 * MIROITEMENT, et c'est LUI qui empeche l'eau de nuit d'avoir l'air morte --
 * une eau simplement assombrie est une eau morte.
 */
export const ECLAT_NUIT = [
  [0.000, 0.000], [0.455, 0.000], [0.500, 0.000], [0.545, 0.054],
  [0.591, 0.188], [0.636, 0.440], [0.682, 0.696], [0.727, 0.840],
  [0.773, 0.906], [0.818, 0.979], [0.864, 1.000], [1.000, 1.000],
];

/** Teintes des deux eclats. Le soleil est chaud, les projecteurs sont froids. */
export const TEINTE_SOLEIL = [1.00, 0.94, 0.82];
export const TEINTE_NUIT = [0.72, 0.92, 1.00];

/**
 * Gains absolus des deux eclats. LES DEUX SEULS CHIFFRES A REGLER A L'OEIL ici :
 * les formes viennent de la mesure, l'intensite est une decision de gout.
 *
 * GAIN_SOLEIL est sans effet tant que ECLAT_SOLEIL est nul ; il reste declare
 * pour que le jour ou un plan avec soleil arrive, il n'y ait qu'une table a
 * remplir.
 */
export const GAIN_SOLEIL = 0.85;
export const GAIN_NUIT = 0.30;

/**
 * Durete du lobe speculaire. Reprise du projet d'origine, ou elle valait 220.
 *
 * C'est elle qui fait la difference entre un scintillement -- quelques facettes
 * qui s'allument -- et un vernis brillant sur toute la surface. Elle se paie en
 * bruit si elle monte trop : une facette qui s'allume sur un seul pixel
 * papillote au lieu de briller.
 */
export const DURETE = 220.0;

/**
 * L'obliquite : de combien la normale doit s'ecarter de la verticale, au centre
 * du miroitement, pour renvoyer le soleil dans l'oeil.
 *
 * Sans effet ici, ECLAT_SOLEIL etant nul. Conservee avec sa valeur d'origine.
 */
export const OBLIQUITE = 0.18;

/**
 * D'ou l'on regarde, en coordonnees du carre unite, v au-dela de 1 puisque
 * l'observateur est en deca du bord proche. Ne sert qu'a orienter l'obliquite.
 */
export const OEIL_UV = [0.49, 1.30];

/**
 * Elargissement du chemin par rapport a l'etendue mesuree. Sans effet ici.
 */
export const ETALEMENT = 1.15;

// --- Le son ------------------------------------------------------------------
//
// Declare des maintenant, mais RIEN NE LE LIT ENCORE : la couche sonore vient a
// la phase suivante. Ces trois valeurs sont le contrat que le comportement de
// l'eau attendra.

/**
 * Le gain maximum de l'eau. JAMAIS un.
 *
 * Le 0,6 vient d'un site ou tout le reste est coupe quand on arrive au bassin :
 * il y a ete calibre CONTRE DU SILENCE. Ici l'eau s'ajoutera a un paysage et ne
 * le remplacera pas. Valeur de depart, a regler a l'oreille contre le vent.
 */
export const EAU_GAIN_MAX = 0.6;

/**
 * Le lissage du gain, en secondes. LE CHIFFRE LE PLUS IMPORTANT DE LA SCENE.
 *
 * La commande arrive image par image : sans ce lissage, le gain saute en
 * escalier et l'on entend un gresillement. Avec, la main est suivie sans
 * latence perceptible.
 */
export const EAU_T_GAIN = 0.08;

/** Retour au silence quand le pointeur quitte le bassin. */
export const EAU_T_SORTIE = 0.4;
