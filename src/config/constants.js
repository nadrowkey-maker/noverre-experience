// Les constantes de ressenti.
//
// Le brief est explicite : « un 0.08 mal choisi s'entend, un 0.4 mal choisi se
// voit ». Chacune porte donc la raison de sa valeur, et pas seulement sa valeur.

// --- Defilement --------------------------------------------------------------
//
// Le defilement natif est desactive et remplace par un modele a impulsions :
// la molette et le doigt ajoutent de la vitesse, la position s'obtient par
// integration. Deux filtres en serie, et c'est la PAIRE qui produit la
// sensation, pas l'un des deux.
//
//   velocite *= exp(-AMORTISSEMENT * dt)                       // la glisse
//   appliquee += (velocite - appliquee) * (1 - exp(-LISSAGE * dt))  // le depart
//   position += appliquee * dt
//
// Ce n'est pas du scroll-jacking dur au sens du brief : rien n'est contraint a
// un cran d'ecran, le visiteur garde un controle continu et peut s'arreter,
// revenir, avancer tres lentement. Ce que ca coute en revanche, c'est le
// clavier, qui n'existe plus tout seul et doit etre reimplemente — le brief
// exige une navigation clavier complete.

/**
 * Amortissement de la vitesse accumulee, en s^-1.
 * Plus petit = glisse plus longtemps apres qu'on a lache.
 */
export const AMORTISSEMENT = 2.6;

/**
 * Lissage de la vitesse appliquee, en s^-1.
 * Plus petit = demarrage plus doux.
 */
export const LISSAGE = 10.0;

/** Conversion des impulsions d'entree en vitesse. */
export const GAIN_MOLETTE = 5.0;

/**
 * Le tactile est plus haut que la molette, et ce n'est pas une inconsequence.
 *
 * Un cran de molette est presque gratuit : le doigt reste pose et la roue
 * repete. Un balayage demande un mouvement de main complet et un lever. A gain
 * egal, allonger le parcours de moitie faisait passer le telephone de 78 a 119
 * balayages pour la page entiere, contre 225 a 342 crans au bureau : la meme
 * croissance en pourcentage, mais pas du tout le meme effort ressenti.
 *
 * 6,8 rend au telephone son nombre de gestes d'avant l'allongement. Il se
 * trouve que c'est aussi la valeur qui rapproche le geste du defilement natif :
 * un balayage de 300 px y parcourt environ 785 px, soit a peu pres une hauteur
 * d'ecran, ce qu'un doigt attend.
 *
 * A confirmer sur un vrai telephone : c'est un cadran de ressenti.
 */
export const GAIN_TACTILE = 6.8;

/**
 * Impulsion d'une touche de clavier, en pixels.
 *
 * Le clavier n'a pas de notion de vitesse : chaque appui envoie une impulsion
 * fixe dans le meme integrateur que la molette, donc la glisse et le lissage
 * s'y appliquent aussi. Une fleche avance d'environ un huitieme d'ecran, une
 * page d'environ trois quarts — les proportions du defilement natif.
 */
export const IMPULSION_FLECHE = 0.125;
export const IMPULSION_PAGE = 0.75;

/**
 * Plafond de vitesse, en px/s.
 *
 * Huit mille, et c'est le reglage anti-traversee eclair : un coup de molette
 * violent ne doit pas pouvoir catapulter le visiteur a travers deux sequences.
 * Il peut aller vite, il ne peut pas fuser.
 */
export const VITESSE_MAX = 8000;

/**
 * Longueur de defilement PAR DEFAUT d'une sequence, en hauteurs d'ecran.
 *
 * Six. Ce site est un objet qu'on regarde, pas une page qu'on traverse : le
 * visiteur de Parkside n'est pas de passage, il est venu donner son attention,
 * et le rythme doit la lui demander. A quatre on arrivait au bout sans avoir eu
 * le temps de rien admirer.
 *
 * C'est le bon levier plutot que de baisser le gain de la molette : un gain
 * plus faible rendrait le geste dur et fatigant, alors qu'un parcours plus long
 * garde exactement la meme glisse et demande simplement plus de trajet.
 *
 * Et il regle un second probleme sans rien couter : le meme clip etale sur
 * cinquante pour cent de distance en plus, c'est cinquante pour cent d'ecart en
 * moins entre deux images consecutives a vitesse egale. Le scrub y gagne en
 * finesse par la meme operation.
 *
 * Chaque sequence peut la redefinir : voir `ecrans` dans config/sequences.js.
 */
export const ECRANS_PAR_SEQUENCE = 6.0;

/**
 * Part de la sequence occupee par l'extinction et le rallumage (D2).
 *
 * Un quart de chaque cote. C'est la meme grammaire partout, seule l'amplitude
 * change : le Seuil descend jusqu'au noir, les six autres passages s'arretent
 * a TRANSITION_FLOOR.
 */
export const PART_FONDU = 0.25;

/**
 * Le fondu ENCHAINE d'entree, en part de segment.
 *
 * Il remplace la baisse de luminosite a toutes les jonctions sauf celle du
 * Seuil. Une baisse assombrissait sans cacher la coupe : on voyait l'image
 * changer a mi-noir, ce qui est pire qu'une coupe franche. Le fondu enchaine,
 * lui, noie le raccord dans la superposition des deux clips.
 *
 * 0,05 : sur un segment de six hauteurs d'ecran a 900 px, cela fait 270 px de
 * defilement, soit une seconde et demie a l'allure de visite. Assez pour que
 * l'oeil ne voie pas de coupe, assez court pour ne pas ramollir le montage.
 */
export const PART_FONDU_ENCHAINE = 0.05;

/**
 * La mise en route d'un segment, en part de segment.
 *
 * Sur les premiers pour cent d'un segment, la progression de l'image est
 * ralentie par une courbe : la camera ne part pas d'un coup a pleine vitesse
 * quand on franchit une frontiere. C'est le defaut entendu au Seuil, ou l'on
 * passait de l'immobilite a un mouvement franc sans transition.
 *
 * La valeur par defaut est nulle -- la plupart des segments enchainent un
 * mouvement deja lance. Seuls ceux qui demarrent a l'arret la declarent.
 */
export const MISE_EN_ROUTE_DEFAUT = 0;

// --- Anneau d'images ---------------------------------------------------------

/**
 * Nombre d'images decodees retenues autour de l'index courant.
 *
 * Une image 1280x720 decodee occupe 3,5 Mio quel que soit son format compresse.
 * 40 images font donc environ 140 Mio, ce que le banc a tenu tres largement :
 * 400 images ont ete retenues sur iPad sans recyclage de l'onglet, soit dix
 * fois cette valeur. 40 est choisi non pas au plafond mais au besoin — de quoi
 * couvrir un aller-retour rapide de la main sans jamais redecoder.
 */
export const RING_SIZE = 40;

/**
 * La fenetre de pourvoi, en PIXELS DE DEFILEMENT et non en nombre d'images.
 *
 * C'est la correction du bug des velos. Toutes les sequences occupent la meme
 * distance de defilement, mais pas le meme nombre d'images : 181 partout, 241
 * au toit, et 361 aux velos, qui restent a 24 images par seconde pour que les
 * manivelles ne soient pas crantees. Une fenetre exprimee en images donnait
 * donc aux velos la MOITIE du tampon des autres -- 180 px d'avance contre 360.
 *
 * Et c'est precisement l'ecran dont le texte dit « Turn the pedals. Faster. »,
 * celui qui pousse le visiteur a defiler le plus vite possible.
 *
 * Exprimee en distance, la fenetre donne le meme tampon partout, et les
 * sequences denses recoivent simplement plus d'images.
 */
export const TAMPON_DEVANT_PX = 420;
export const TAMPON_DERRIERE_PX = 180;

/**
 * Part de l'anneau que la fenetre peut occuper.
 *
 * Deux tiers : le tiers restant est la marge qui garantit qu'une image demandee
 * n'est jamais jetee avant d'avoir servi.
 */
export const PART_FENETRE = 0.66;

/**
 * Plafond de l'anneau, en images.
 *
 * 90 images a 1280 font environ 315 Mio de memoire decodee pour un seul
 * segment. C'est beaucoup, et c'est pourquoi il y a un plafond : au-dela, une
 * sequence dense couterait plus que ce qu'un onglet mobile accepte. Quand le
 * plafond mord, le tampon est simplement plus court sur cette sequence -- ce
 * qui reste preferable a un onglet recycle.
 */
export const RING_MAX = 90;

// --- Mode degrade ------------------------------------------------------------

/**
 * Seuil de coeurs en dessous duquel on degrade d'office. Vient du brief.
 */
export const DEGRADED_MIN_CORES = 4;

/**
 * Duree du premier rendu, en millisecondes, au-dela de laquelle on degrade.
 * Vient du brief. 22 ms, soit deja plus d'une trame a 60 Hz : un appareil qui
 * met ce temps sur la premiere image ne tiendra pas le plancher de 30 img/s.
 */
export const DEGRADED_FIRST_RENDER_MS = 22;

/**
 * En mode degrade, on ne garde qu'une image sur deux — six par seconde au lieu
 * de douze — et un anneau plus court. Moins d'images a decoder par seconde de
 * defilement, moins de memoire retenue.
 *
 * Le brief est net sur le fait que cette version doit rester belle : une image
 * sur deux sur un mouvement lent reste lisible, ce n'est pas le cas d'une image
 * sur quatre.
 */
export const DEGRADED_FRAME_STEP = 2;
export const DEGRADED_RING_SIZE = 20;

/**
 * Troisieme declencheur : la chute d'images soutenue.
 *
 * Il y en avait un quatrieme, le debit mesure au chargement. Il est retire : sa
 * fenetre de mesure contenait le decodage de l'image, qui domine largement le
 * transfert, et il etait calcule sur un seul fichier. Il annoncait 0,1 Mbit/s
 * en local et faisait donc demarrer TOUTE machine en mode degrade. Ce n'etait
 * pas une mesure de reseau, c'etait une mesure de processeur -- que la chute
 * d'images ci-dessous fait deja, correctement et en continu.
 *
 * Un appareil plus faible que l'iPad peut passer les deux controles statiques
 * du brief puis saccader. On observe donc une fenetre glissante : si plus d'un
 * quart des trames y depassent 33 ms, on bascule. La fenetre fait deux
 * secondes pour qu'un a-coup isole — un onglet revenu d'arriere-plan, une
 * notification — ne declenche rien.
 */
export const DEGRADED_FENETRE_MS = 2000;
export const DEGRADED_PART_TRAMES_LENTES = 0.25;
export const DEGRADED_TRAME_LENTE_MS = 1000 / 30;

// --- Son : constantes de mecanisme -------------------------------------------
//
// Ce qui gouverne la page entiere vit ici. Ce qui depend d'une scene -- les
// niveaux de chaque couche, les parts, les images de declenchement -- vit dans
// config/sequences.js, pour qu'une passe de reglage n'ouvre que deux fichiers.

/**
 * Constante de temps du lissage des gains, en secondes.
 *
 * Une a deux secondes. C'est ce lissage qui tue l'effet mecanique : si le
 * visiteur descend d'un coup sec, l'image saute mais la ville met deux secondes
 * a arriver. Elle ne peut pas etre brusquee. Sans lui, chaque cran de molette
 * produirait un micro-saut de niveau, ce qui sonnerait comme une machine.
 */
export const TAU_GAIN = 1.5;

/** Le scellement : le filtre court devant, le volume traine derriere. */
export const SCELLEMENT_FILTRE_OUVERT = 18000;
export const SCELLEMENT_FILTRE_FERME = 200;
export const SCELLEMENT_T_FILTRE = 0.2;
export const SCELLEMENT_T_VOLUME = 0.65;

/**
 * La traversee de vitre, a l'aller : les trois pistes exterieures arrivent
 * ensemble, filtre et volume en meme temps, en trois dixiemes de seconde.
 * On ne traverse pas une vitre progressivement. C'est le seul mouvement brusque
 * autorise de toute la page, et il est justifie : une fois le verre franchi il
 * n'y a physiquement plus rien entre l'interieur et l'exterieur.
 */
export const TRAVERSEE_T_ALLER = 0.3;

/**
 * La salle de velos : le seul endroit qui obeisse a la VITESSE du defilement.
 *
 * Scroll lent, le morceau s'entend comme a travers une porte fermee ; scroll
 * rapide, le filtre s'ouvre. C'est ce qui fait que le visiteur pousse pour
 * obtenir la musique -- et c'est pour ca que c'est un jeu et non un gain vole
 * a la regle de l'horloge.
 */
export const VELOS_FILTRE_FERME = 500;
export const VELOS_FILTRE_OUVERT = 18000;
/**
 * Vitesse de defilement, en px/s, a laquelle le filtre est grand ouvert.
 *
 * 5200, et non 2600. A 2600, un defilement ordinaire -- entre 1500 et 3000 px/s
 * -- ouvrait deja le filtre aux deux tiers : l'effet existait mais le visiteur
 * ne le traversait jamais, il arrivait deja en haut de la courbe. On n'entendait
 * donc plus la musique se reveler, seulement de la musique.
 *
 * A 5200, soit les deux tiers du plafond de vitesse, un defilement ordinaire
 * n'ouvre qu'a un tiers et il faut vraiment pousser pour tout obtenir.
 */
export const VELOS_VITESSE_PLEINE = 5200;
/** Lissage du filtre : assez court pour que la main soit suivie. */
export const VELOS_TAU_FILTRE = 0.25;

/**
 * Courbure de la reponse du filtre a la vitesse.
 *
 * 0,45, donc concave : a un tiers de la vitesse pleine le filtre est deja
 * ouvert aux deux tiers. En reponse LINEAIRE, un defilement lent et constant
 * n'ouvrait presque rien et l'on n'entendait jamais le morceau se reveler --
 * il fallait un a-coup violent, que personne ne fait en regardant.
 *
 * Le plafond reste haut pour que pousser serve encore a quelque chose : c'est
 * la concavite qui donne la sensibilite, pas l'abaissement du seuil.
 */
export const VELOS_COURBE = 0.45;

/**
 * Les trois salles : une seule pente monotone du maximum au minimum.
 *
 * Le code calcule une valeur unique -- la distance a la salle de velos -- qui
 * va de 0 a 1. Deux parametres la suivent. Cuire cette decroissance dans un
 * troisieme fichier serait une erreur : elle tomberait a un instant fixe du
 * morceau, et non au moment ou le visiteur arrive.
 */
/**
 * Niveau du morceau A L'ENTREE DE LA SALLE DE SPORT, en decibels.
 *
 * -16 et non 0. A pleine echelle il couvrait l'ambiance de la salle, alors que
 * le document dit l'inverse : « l'ambiance domine, la musique est une rumeur
 * derriere un mur ; si l'on peut suivre le morceau, elle est trop forte ».
 */
export const MUR_DB_DEBUT = -16;
/**
 * Fin de la pente. -52, soit quarante decibels sous l'entree, ce qui est
 * exactement la chute que le document decrit -- et un niveau inaudible.
 */
export const MUR_DB_FIN = -56;
/**
 * Courbure de la pente des trois salles.
 *
 * 0,8, donc legerement concave : le morceau chute plus vite des l'entree dans
 * la salle de sport, puis se retire lentement. En pente droite il restait trop
 * present au debut -- le document veut l'inverse, « l'ambiance domine, la
 * musique est une rumeur derriere un mur ».
 *
 * Pas davantage : a 0,55 la chute atteignait vingt-sept decibels au
 * franchissement du mur, alors qu'il doit y rester une masse grave nettement
 * audible. La sensibilite se prend sur le NIVEAU D'ENTREE, pas sur la
 * courbure.
 *
 * La concavite descend sans creer de marche : a la frontiere la valeur est
 * exactement celle des velos, elle ne fait que partir plus vite.
 */
export const MUR_COURBE = 0.8;

export const MUR_FILTRE_DEBUT = 400;
export const MUR_FILTRE_FIN = 100;

/**
 * Le rideau, et l'eau du toit : les deux seuls endroits ou le lissage se compte
 * en centiemes et non en secondes.
 *
 * Le rideau s'eteint franchement, en cinquante millisecondes : un rideau qui
 * s'arrete s'arrete. L'eau suit la main a 0,08 s -- sans ce lissage le gain
 * saute en escalier et l'on entend un gresillement.
 */
export const RIDEAU_T_EXTINCTION = 0.05;
export const EAU_T_GAIN = 0.08;
export const EAU_T_SORTIE = 0.4;
/** Vitesse de pointeur, en px par trame, a laquelle l'eau est a plein. */
export const EAU_VITESSE_PLEINE = 30;
/**
 * Gain maximum de l'eau, jamais 1.
 *
 * Le 0,6 du document vient d'un site ou tout le reste est coupe quand on arrive
 * au bassin : il y a ete calibre contre du silence. Ici l'eau s'ajoute a un
 * paysage -- le vent, la ville tres loin, le parc qui remonte -- donc ce
 * maximum est a regler A L'OREILLE contre le vent, et il sera probablement
 * different. Valeur de depart, pas valeur juste.
 */
export const EAU_GAIN_MAX = 0.6;

// --- Transitions (D2) --------------------------------------------------------

/**
 * Le Seuil va jusqu'au noir complet et tient. Les six autres passages sont de
 * breves baisses qui ne touchent jamais le noir, sinon le Seuil perd son statut
 * d'evenement. Meme grammaire, amplitude differente.
 *
 * Valeurs en luminosite restante : 0 est le noir, 1 l'image intacte.
 */
export const SEUIL_FLOOR = 0.0;
export const TRANSITION_FLOOR = 0.55;

/**
 * L'extinction du Seuil : plus longue ET plus complete que les six autres.
 *
 * Le plancher a zero la rendait deja plus complete, mais elle durait autant
 * qu'une baisse ordinaire et n'avait aucune tenue -- elle atteignait le noir
 * exactement a la derniere image, donc on n'y restait pas. Or le document en
 * fait un moment a part entiere : « deux secondes de presque rien ». Sans la
 * tenue, l'extinction perd son statut d'evenement et redevient une transition.
 *
 * La descente occupe 0,28 de la sequence, puis 0,12 sont tenus au noir. A
 * l'allure nominale un segment dure une vingtaine de secondes, ce qui met la
 * tenue autour de deux secondes et demie.
 */
export const PART_FONDU_SEUIL = 0.28;
export const PART_TENUE_SEUIL = 0.12;

// --- L'ouverture ---------------------------------------------------------
//
// Une porte, puis une amorce. Le visiteur choisit d'entrer avec ou sans le son,
// l'ecran redevient noir, et le logo arrive sur une musique avant que le
// batiment n'apparaisse. C'est ce qui donne le sentiment d'entrer dans un
// univers plutot que d'ouvrir une page.
//
// Ces neuf secondes sont AUSSI le prechargeur que le brief exige : on y amorce
// les premieres sequences, sans jamais montrer un pourcentage.

/**
 * Ouverture du bus principal depuis la porte, en secondes.
 *
 * 2,8. Le bus s'ouvrait en 0,4 s, et c'est lui qui rendait l'entree des
 * insectes brutale -- pas les nappes, qui visent deja leur niveau sur une
 * seconde et demie. Le plus rapide des deux commande, et 0,4 s sur un fond de
 * foret produit un declic.
 *
 * A 2,8 s le parc ne demarre pas, il se revele : au moment ou le logo commence
 * a se former, on ne sait pas encore si l'on entend quelque chose. C'est ce que
 * le document decrit -- « partir de zero n'est pas un detail : aller de rien a
 * quelque chose est un geste beaucoup plus fort qu'aller de peu a plus ».
 */
export const OUVERTURE_SON = 2.8;

/**
 * Effacement de l'ecran d'accueil, en secondes.
 *
 * 0,55. Les deux boutons, le casque et la phrase s'en vont ensemble, en fondu.
 * Ils disparaissaient d'un coup, ce qui donnait un a-coup au moment meme ou
 * l'amorce doit prendre la main en douceur.
 *
 * La duree chevauche volontairement l'apparition du logo, qui commence a
 * 0,35 s : l'accueil n'a pas fini de partir que le nom commence deja a se
 * former. C'est ce chevauchement qui fait qu'on ne voit aucune couture.
 */
export const PORTE_SORTIE_CHOIX = 0.55;

/** Apparition du logo, en secondes depuis le debut de l'amorce. */
export const INTRO_LOGO_ENTREE = 0.35;
export const INTRO_LOGO_FONDU = 2.4;

/**
 * Grossissement du logo, du debut a la fin de l'amorce.
 *
 * De 0,76 a 1,12 : une poussee lente et continue, jamais un zoom. Au cinema le
 * titre ne bondit pas, il avance. Le mouvement reste a la limite du
 * perceptible -- s'il se remarque, il devient un effet -- mais la course est
 * assez longue pour qu'on sente le nom venir vers soi.
 */
export const INTRO_LOGO_ECHELLE_DEBUT = 0.76;
export const INTRO_LOGO_ECHELLE_FIN = 1.12;

/**
 * Le drop : l'image du batiment monte du noir.
 *
 * 6,0 s, mesure. Le morceau a TROIS evenements et il faut prendre le bon :
 *
 *   4,35 s  le debut de la montee du grave
 *   4,80 s  une frappe breve -- le grave gagne quinze decibels puis RETOMBE a
 *           -49 dB des 5,20. C'est un coup d'annonce, pas le drop.
 *   6,00 s  le grave et le niveau global culminent ENSEMBLE, et le grave s'y
 *           installe au lieu de retomber.
 *
 * C'est la qu'il atterrit. Un detecteur de plus forte montee designe le premier
 * des trois, ce qui faisait arriver le batiment une seconde et demie trop tot.
 *
 * Le fondu est court -- 1,1 s -- parce qu'un drop est un evenement : une montee
 * lente le raterait, l'image serait deja la quand le son frappe.
 */
export const INTRO_DROP = 6.0;
export const INTRO_DROP_FONDU = 1.1;

/**
 * Le logo tient DEUX SECONDES apres le drop, puis s'efface.
 *
 * C'est le moment ou il est le plus beau : il est encore la, en inversion
 * temps reel, par-dessus le batiment qui vient d'apparaitre.
 */
export const INTRO_LOGO_SORTIE = 8.0;
export const INTRO_LOGO_SORTIE_FONDU = 1.2;
export const INTRO_FIN = 9.4;

/**
 * Le flou du logo, en pixels, a son apparition.
 *
 * VINGT-DEUX, et non vingt-huit. Ce n'est pas un reglage de gout, c'est une
 * consequence de la geometrie du mot-symbole, et c'est verifie a l'image.
 *
 * Parkside avait un logo trapu -- son encre mesure 1526 x 475, soit un rapport
 * de 3,21 -- et vingt-huit pixels de flou y valaient 23 % de la hauteur des
 * lettres. NOVERRE est un mot long et fin : 1664 x 241, rapport 6,90. A la
 * meme largeur d'affichage ses lettres font 65 px de haut la ou celles de
 * Parkside en faisaient 124.
 *
 * Rendu et regarde a mi-amorce, la ou le mot doit etre en train de se former :
 *
 *   28   une simple tache. On ne devine meme pas qu'il y a des lettres --
 *        exactement le defaut que la valeur d'origine cherchait a eviter.
 *   18   deja lisible. Le nom ne se forme plus, il est la.
 *   22   on ne lit pas, mais on voit qu'il y a un mot. C'est ce qui est voulu.
 *
 * Le meme nombre ne donne pas le meme resultat sur un autre dessin : c'est le
 * RESULTAT qui se transpose, pas la valeur.
 *
 * Le MINUTAGE, lui, ne bouge pas d'un dixieme -- il est cale sur `logo.mp3`, et
 * c'est le meme fichier. Verifie : le flou atteint zero a 6,0 s, exactement sur
 * le drop, et le voile se leve dans la foulee.
 */
export const INTRO_LOGO_FLOU = 22;

/**
 * L'instant ou le logo devient NET, en secondes.
 *
 * Le flou a sa propre duree, bien plus longue que la montee d'opacite : le nom
 * apparait vite mais met presque six secondes a se former, et il finit
 * exactement sur le drop. C'est ce qui fait que l'image du batiment et la
 * nettete du nom arrivent au meme instant, sur le meme coup.
 *
 * Sept dixiemes APRES le drop, et non pile dessus : la derniere pincee de
 * nettete se joue donc pendant que le batiment monte du noir. Le nom finit de
 * se former sur l'image, pas avant elle.
 *
 * Le lier a l'opacite, comme au premier essai, resorbait le flou en deux
 * secondes : le nom etait net bien avant que quoi que ce soit ne se passe.
 */
export const INTRO_LOGO_NET = INTRO_DROP + 0.7;

/**
 * Facteur applique a toutes les durees quand on entre EN SILENCE.
 *
 * 0,55. L'amorce vaut par elle-meme et son rythme reste le meme pour tous,
 * mais sans la musique ces neuf secondes n'ont plus de raison de durer : le
 * minutage etait celui du morceau, pas celui de l'image.
 */
export const INTRO_FACTEUR_SILENCE = 0.55;

/**
 * Lissage des trois barres du vumetre, en secondes.
 *
 * Montee immediate, descente en 0,25 s : c'est la loi d'un vumetre a aiguille,
 * et c'est ce qui le rend lisible. Une descente instantanee ferait clignoter,
 * une descente lente ferait flotter.
 */
export const VUMETRE_T_DESCENTE = 0.25;

/**
 * L'EVEIL DU BASSIN : sur quelle part du segment du toit la houle monte.
 *
 * Le bassin ne prend l'ecran qu'apres le fondu d'entree, et l'echange des deux
 * canvas se ferait voir si l'eau se mettait a bouger dans la meme trame. A
 * force nulle le bassin rend la plaque intacte, exactement ce que peignait le
 * canvas 2D : la bascule est alors invisible, et l'eau se reveille ensuite.
 *
 * Six pour cent du segment, soit un peu plus d'une seconde au defilement
 * normal. Assez pour ne pas se voir, assez court pour que le visiteur qui
 * s'arrete tout de suite ait deja une eau vivante sous la main.
 */
export const EVEIL_BASSIN = 0.06;

/**
 * LE PLAFOND DE REQUETES EN VOL, TOUTES SEQUENCES CONFONDUES.
 *
 * C'est la correction du gel de l'image sur le site deploye, et le defaut
 * etait invisible en local.
 *
 * L'anneau borne le nombre de demandes PAR APPEL (`paquet`), jamais le nombre
 * de requetes SIMULTANEMENT EN VOL. Or `pourvoir` est appele a chaque trame, et
 * `alimenterVoisins` fait de meme sur les deux segments voisins : a soixante-
 * quinze trames par seconde, cela represente jusqu'a sept cents nouvelles
 * requetes par seconde.
 *
 * En local, chacune revient en 0,45 ms : le debit de sortie depasse le debit
 * d'entree et rien ne s'accumule. Sur un vrai reseau chacune prend 50 a 200 ms,
 * et la file grossit sans borne. Mesure sur le site deploye, en defilant
 * doucement :
 *
 *   pas de defilement    0     6     13
 *   requetes lancees    38   249    562
 *   requetes TERMINEES  27    27     27
 *   en vol              11   222    535
 *
 * Plus une seule ne se termine : l'image dont on a besoin MAINTENANT attend
 * derriere cinq cents demandes emises pour des positions deja depassees.
 * L'anneau ne recoit plus rien, `image()` rend la plus proche qu'il possede --
 * la derniere -- et l'ecran se fige pendant que le son et le texte continuent.
 * Revenir en arriere « debloque » parce que les octets d'avant sont, eux, deja
 * en memoire.
 *
 * Huit : un navigateur n'ouvre que six connexions par origine en HTTP/1.1, et
 * ce qui compte en HTTP/2 n'est pas le nombre de flux mais la LONGUEUR DE LA
 * FILE. Huit images de 120 Ko occupent la liaison sans jamais faire attendre
 * celle du centre, et suffisent largement : le decodage n'en absorbe que trente
 * a soixante par seconde.
 *
 * Ce qui est refuse n'est pas perdu : `pourvoir` redemande a la trame suivante,
 * en repartant de la position COURANTE. Le plafond transforme donc une file
 * d'attente perimee en une demande toujours a jour.
 */
export const PLAFOND_REQUETES_EN_VOL = 8;
