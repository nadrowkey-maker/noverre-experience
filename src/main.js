// Orchestration.
//
// Deux modes, decides une fois au demarrage et jamais melanges :
//
//   parcours          le defilement natif est desactive, la position s'obtient
//                     par integration d'impulsions, les segments sont scrubbes.
//   mouvement reduit  le document redevient un document : defilement natif,
//                     une image fixe CHOISIE par sequence, aucune boucle rAF.
//
// Aucun reglage ne vit ici. Le rythme, les raccords et les images fixes sont
// dans config/sequences.js ; les constantes de mecanisme dans
// config/constants.js. Une passe de reglage n'ouvre que ces deux fichiers.
//
// LE SON est branche ici, et deux objets y sont PARTAGES entre plusieurs
// scenes plutot que crees par chacune : la chaine des velos, dont le morceau
// traverse trois sequences sans que sa tete de lecture ne reparte, et la
// traversee de facade, que quatre sequences declarent. Le detail du pourquoi
// est au-dessus du bloc concerne.
//
// Le defilement n'est PAS active au chargement : la Porte le rend a la fin de
// l'amorce. Pendant l'ouverture, la molette ne fait rien.

import {
  SEQUENCES, PORTE, FACADE, choisirJeu, premiere, derniere, imageGlobale,
} from './config/sequences.js';
import { creerDefilement } from './scroll/smooth-scroll.js';
import { creerCarte } from './scroll/sequence-map.js';
import { creerSource } from './frames/frame-source.js';
import { creerAnneau } from './frames/frame-ring.js';
import { creerRendu } from './frames/frame-renderer.js';
import { luminositePour } from './frames/transitions.js';
import {
  PART_FONDU_ENCHAINE, MISE_EN_ROUTE_DEFAUT, EVEIL_BASSIN,
  OUVERTURE_SON, INTRO_LOGO_ENTREE,
} from './config/constants.js';
import {
  ouvrir, fermer, estOuvert, jouerAmorce, prechargerAmorce,
  surBascule as surSon,
} from './audio/graph.js';
import { creerScene, creerBanque } from './audio/scene.js';
import { creerChaineVelos } from './audio/behaviours/velos.js';
import { creerTraversee } from './audio/behaviours/traversee.js';
import { creerPorte } from './ui/porte.js';
import { creerVumetre } from './ui/vumetre.js';
import { alimenterVoisins, fenetrePour } from './frames/prefetch.js';
import {
  deciderAFroid, evaluerPremierRendu, signalerTrame,
  surBascule, estDegrade, raisonDegrade, reglages,
} from './quality/degraded.js';
import { creerCurseur } from './ui/curseur.js';
import { creerFaits } from './ui/faits.js';
import { creerNarration } from './ui/narration.js';
import { creerBassin } from './water/bassin.js';

const canvas = document.getElementById('scene');
const canvasEau = document.getElementById('eau');
const temoin = document.getElementById('temoin');
// Le temoin ne s'affiche plus pendant la visite : il disait la cadence, le jeu
// d'images et la taille d'anneau, ce qui sert a REGLER le site et jamais a le
// regarder. Il reste dans le document et continue de se mettre a jour -- c'est
// lui qui porte la mesure de cadence sur un vrai telephone (§10.9), et les
// bancs lisent son texte pour savoir quel segment est a l'ecran.
if (new URLSearchParams(location.search).has('temoin')) {
  document.documentElement.dataset.temoin = 'oui';
}
const bouton = document.getElementById('son');
const motSon = document.getElementById('son-mot');
const barres = [...document.querySelectorAll('#son .barres i')];
const mouvementReduit = matchMedia('(prefers-reduced-motion: reduce)').matches;

deciderAFroid();
let cfg = reglages();

// Le jeu d'images est choisi une fois, avant toute requete. Un appareil degrade
// prend le jeu mobile quelle que soit sa fenetre : ce qui lui manque est du
// decodage, pas des pixels.
const jeu = choisirJeu({ forcerMobile: estDegrade() });
const rendu = creerRendu(canvas, { largeurSource: jeu });
const carte = creerCarte();

// Un anneau par segment, cree a la demande et detruit quand le segment sort du
// voisinage : on ne garde jamais plus de trois segments decodes.
const anneaux = new Map();

/** Premiere et derniere image REELLEMENT parcourues d'un segment. */
const bornesDe = (seq) => [seq.imageDebut ?? 1, seq.imageFin ?? seq.frames];

/** La fenetre d'un segment depend de sa densite d'images, pas du seul mode. */
const fenetres = new Map();
function fenetreDe(i) {
  const cle = `${i}:${cfg.pasImage}`;
  if (!fenetres.has(cle)) {
    const [d, f] = bornesDe(SEQUENCES[i]);
    fenetres.set(cle, fenetrePour(f - d + 1, carte.spanDe(i), cfg));
  }
  return fenetres.get(cle);
}

/**
 * L'index d'image d'un segment a la progression t.
 *
 * `miseEnRoute` freine le debut : sur cette part du segment, la progression
 * suit un carre au lieu d'une droite, donc la camera part lentement et prend
 * sa vitesse. Sans elle, franchir une frontiere depuis un plan immobile lance
 * le mouvement d'un coup. Une seule sequence en porte une ici, et c'est
 * mesure : voir config/sequences.js.
 */
function imageA(seq, t) {
  const [deb, fin] = bornesDe(seq);
  const mer = seq.miseEnRoute ?? MISE_EN_ROUTE_DEFAUT;
  let u = t;
  if (mer > 0 && t < mer) u = (t * t) / mer;
  return deb + u * (fin - deb);
}

/**
 * L'index d'image NORMALISE d'un segment, de 0 a 1.
 *
 * C'est ce que le bassin doit recevoir, et non la progression `t` : les reperes
 * de calage sont poses sur des index d'image, alors que `t` suit une loi en
 * carre au debut d'un segment qui porte une `miseEnRoute`. Sur Parkside les
 * deux coincidaient parce que le segment du toit n'en avait pas ; ici on ne
 * laisse pas la question se poser.
 */
function indexNormalise(seq, t) {
  const [deb, fin] = bornesDe(seq);
  if (fin <= deb) return 0;
  return (imageA(seq, t) - deb) / (fin - deb);
}

function anneauPour(i) {
  if (!anneaux.has(i)) {
    const seq = SEQUENCES[i];
    anneaux.set(i, creerAnneau(creerSource(seq.id), {
      taille: fenetreDe(i).taille, pasImage: cfg.pasImage, nbImages: bornesDe(seq)[1],
    }));
  }
  return anneaux.get(i);
}

function elaguer(garder) {
  for (const [i, a] of anneaux) {
    if (!garder.includes(i)) { a.detruire(); anneaux.delete(i); }
  }
}

// ---------------------------------------------------------------------------
// LE SON.
//
// Aucun son ne demarre sans clic explicite : le contexte est cree suspendu, et
// c'est la Porte qui l'ouvre. La bascule reste accessible en permanence.
//
// Deux objets sont PARTAGES entre plusieurs scenes et crees ici, pas dans
// `creerScene` :
//
//   la chaine des velos   le morceau traverse trois sequences sans que sa tete
//                         de lecture ne reparte : c'est ce qui fait de la chute
//                         du maximum au minimum un seul geste.
//   la traversee          quatre sequences la declarent -- deux excursions qui
//                         enjambent chacune deux segments. Quatre instances
//                         tomberaient dans le piege de la §6.7 : la banque ne
//                         route une piste vers un filtre qu'A SA CREATION, donc
//                         les trois dernieres recupereraient `parc-jour` deja
//                         branche sur le filtre de la premiere, et leur
//                         scellement n'aurait aucun effet.
// ---------------------------------------------------------------------------
const banque = creerBanque();
const scenes = new Map();
let chaineVelos = null;
let traversee = null;
let scenePorte = null;
let scenesPretes = false;

async function activerSon(duree) {
  await ouvrir(duree);
  if (scenesPretes) return;
  scenesPretes = true;
  chaineVelos = await creerChaineVelos(banque);
  traversee = await creerTraversee(FACADE, banque);
  // Les nappes tournent en permanence des l'ouverture, chacune a sa vitesse
  // reelle : le defilement ne fait que doser.
  for (let i = 0; i < SEQUENCES.length; i++) {
    scenes.set(i, await creerScene(SEQUENCES[i], banque, chaineVelos, traversee));
  }
  // L'ecran d'entree a sa propre scene : les insectes de la nuit sous les deux
  // boutons. Elle vit tant que la porte est la, et se tait au premier segment.
  scenePorte = await creerScene(PORTE, banque, null, null);
  scenePorte.melanger(0, 0, {});

  // ON REND TOUT DE SUITE LA MAIN A LA TRAVERSEE SI LE SEGMENT COURANT N'EN A
  // PAS.
  //
  // `scenesBasculer` n'est appele qu'au CHANGEMENT de segment, et le segment
  // courant n'a pas change depuis le chargement : on est toujours sur le
  // premier. Rien ne viendrait donc dire a la traversee qu'elle n'a pas la main
  // ici -- or elle vient d'etre creee avec son scellement FERME, et elle route
  // `foret-jour`, `parc-jour`, `lointain` et `vent` a travers lui. Le lever du
  // jour de la premiere sequence se jouait alors entierement derriere une vitre
  // fermee : passe-bas a 200 Hz et -46 dB, donc rien.
  //
  // On n'appelle PAS `scenesBasculer` ici, qui ferait taire la scene de la
  // porte alors qu'elle doit vivre pendant toute l'amorce.
  const seqCourante = SEQUENCES[segmentVu];
  if (traversee && seqCourante && !seqCourante.traversee) traversee.taire();
}

/** La scene d'un segment prend la main, les autres se taisent. */
function scenesBasculer(index) {
  if (scenePorte) { scenePorte.taire(); scenePorte = null; }
  for (const [k, s] of scenes) if (k !== index) s.taire();
  const seq = SEQUENCES[index];
  // Le morceau des velos traverse trois sequences. Il ne se tait que lorsque le
  // segment COURANT n'en fait pas partie -- jamais a cause d'une scene qu'on
  // vient de quitter, ce qui dependrait de l'ordre des appels.
  if (chaineVelos && seq && !seq.velos && !seq.distanceVelos) chaineVelos.taire();
  // Meme regle pour la traversee, et pour la meme raison.
  if (traversee && seq && !seq.traversee) traversee.taire();
}

/** Le melange suit la POSITION, jamais la vitesse. */
function scenesMelanger(index, t, image, infos) {
  scenes.get(index)?.melanger(t, image, infos);
}

/**
 * L'eau du bassin, seul son pilote par la MAIN et non par le defilement.
 *
 * `null` veut dire « plus personne ne touche l'eau » et doit etre dit A CHAQUE
 * TRAME ou le bassin ne rend pas -- mode degrade, WebGL absent, mouvement
 * reduit. Sans cela, personne ne peut plus fermer la piste : sur Parkside
 * l'eau restait ouverte pour toute la fin de la visite. Une piste qui ne peut
 * pas se fermer est une piste qui finira ouverte.
 */
function eauSuivre(index, vitesse) {
  scenes.get(index)?.eauSuivre(vitesse);
}

bouton.addEventListener('click', async () => {
  if (estOuvert()) fermer(); else await activerSon();
});
surSon((ouvert) => {
  bouton.setAttribute('aria-pressed', String(ouvert));
  motSon.textContent = ouvert ? 'Sound' : 'Silent';
});

// Les trois barres du bouton, branchees sur le bus principal. Elles ne sont
// creees qu'a la premiere ouverture du son : avant, il n'y a pas de contexte.
let vumetre = null;

const curseur = creerCurseur(document.getElementById('curseur'));
const faits = creerFaits(document.getElementById('faits'),
                         document.getElementById('faits-lignes'));
const narration = creerNarration(document.getElementById('narration'),
                                 document.getElementById('narration-ligne'),
                                 document.getElementById('narration-voile'));

/**
 * Le bassin WebGL, cree paresseusement a la premiere entree sur la piscine.
 *
 * Il ne se cree pas au demarrage : un contexte WebGL coute de la memoire, et le
 * visiteur met quatre minutes a l'atteindre. En mode degrade il ne se cree
 * jamais -- c'est le premier poste a sacrifier sur un appareil qui peine.
 */
let bassin = null;
let bassinEssaye = false;
// Ce que le temoin dira de l'eau. Sans cette phrase, une eau qui ne bouge pas
// sur l'appareil de quelqu'un d'autre est indiagnosticable a distance : c'est
// exactement la situation dans laquelle on s'est trouve.
let bassinEtat = 'pas encore atteinte';

// L'EAU SE MESURE ELLE-MEME, ET C'EST ELLE QUI DECIDE DE PARTIR.
//
// Elle etait coupee des que le mode degrade se declenchait. Le raisonnement
// tenait mal : le levier du mode degrade est le DECODAGE -- une image sur deux
// -- alors que le bassin est du travail de carte graphique. Un telephone qui
// peine a decoder n'est pas forcement un telephone qui peine a dessiner, et on
// lui retirait le final du site sur une presomption.
//
// Et la presomption ne pouvait pas etre verifiee d'ici : le banc rend le GPU en
// logiciel, sur le processeur, qu'on bride ensuite. Il mesure 75 img/s sans
// l'eau et 27 avec -- un chiffre qui parle du banc, pas d'un iPhone.
//
// Alors on ne presume plus, on regarde. L'eau se pose, et si la cadence reste
// sous le plancher de trente images par seconde PENDANT QU'ELLE DESSINE, elle
// se retire d'elle-meme et rend l'ecran au canvas 2D. Chaque appareil repond
// pour lui, y compris ceux qu'on n'a pas. Trois secondes, et non une : entrer
// dans la piscine coute un fondu et des decodages, et un creux d'une seconde
// la ne veut rien dire.
const PLANCHER_EAU = 30, SECONDES_LENTES_AVANT_ABANDON = 3;
let bassinAbandonne = false, bassinADessine = false, secondesLentesEau = 0;
function bassinPour() {
  // LE CONTEXTE PEUT SAUTER EN COURS DE VISITE, et sur telephone c'est
  // courant. On le reprend s'il revient, on rend la main au canvas 2D sinon.
  if (bassin && bassin.perdu()) {
    if (bassin.recupere()) {
      bassin = null; bassinEssaye = false;
      bassinEtat = 'contexte rendu, bassin reconstruit';
    } else {
      bassinEtat = 'contexte WebGL perdu, repli 2D';
      return null;
    }
  }
  if (bassinAbandonne) return null;
  if (bassinEssaye) return bassin;
  bassinEssaye = true;
  if (!cfg.eau) { bassinEtat = 'coupee a la main (?eau=0)'; return null; }
  // `?eau=1` bloque aussi le retrait automatique. Sans cela les bancs, qui
  // rendent le GPU en LOGICIEL, se retirent l'eau tout seuls -- ils tournent a
  // 17 img/s sur la piscine meme sans bridage, ce qui parle du rasteriseur et
  // pas du site. C'est le meme esprit que `?degraded=0` : un forcage explicite
  // vaut dans les deux sens.
  if (cfg.eauForcee) bassinAbandonne = false;
  try {
    bassin = creerBassin(canvasEau);
    bassinEtat = bassin ? `eau, filtrage ${bassin.filtrage}` : 'WebGL2 absent, repli 2D';
  } catch (e) {
    // Le bassin est le seul ecran WebGL de la page. S'il ne se cree pas, on
    // continue en 2D : la piscine reste une belle image, ce qui est exactement
    // la version degradee voulue.
    console.warn('bassin indisponible, repli sur le rendu 2D : ' + e.message);
    bassinEtat = `repli 2D — ${e.message}`;
    bassin = null;
  }
  return bassin;
}

// ---------------------------------------------------------------------------
/**
 * Le compteur d'images par seconde.
 *
 * Il est ICI et non dans quality/degraded.js, qui cesse de compter des qu'il a
 * bascule -- son role est de decider, pas de renseigner. Or c'est justement
 * APRES la bascule qu'on veut savoir si le mode degrade suffit.
 *
 * Il sert a la mesure du plancher de 30 images par seconde sur materiel reel,
 * la seule des trois mesures de la §10.9 qu'on ne peut pas faire sans un vrai
 * telephone. On retient aussi le PIRE creux glissant : une moyenne a 55 avec
 * des chutes a 12 se regarde tres differemment d'un 55 regulier.
 */
let fps = 0, fpsMin = Infinity, fpsTrames = 0, fpsDepuis = 0;
function compterTrame(maintenant) {
  fpsTrames++;
  if (!fpsDepuis) { fpsDepuis = maintenant; return false; }
  if (maintenant - fpsDepuis < 500) return false;
  fps = (fpsTrames * 1000) / (maintenant - fpsDepuis);

  // Le verdict de l'eau. On ne compte que les fenetres ou elle a REELLEMENT
  // dessine : partout ailleurs la cadence ne dit rien d'elle.
  if (bassinADessine && maintenant > 4000) {
    secondesLentesEau = fps < PLANCHER_EAU ? secondesLentesEau + 1 : 0;
    if (secondesLentesEau >= SECONDES_LENTES_AVANT_ABANDON
        && !bassinAbandonne && !cfg.eauForcee) {
      bassinAbandonne = true;
      bassinEtat = `retiree : moins de ${PLANCHER_EAU} img/s pendant ${SECONDES_LENTES_AVANT_ABANDON} s`;
    }
  } else {
    secondesLentesEau = 0;
  }
  bassinADessine = false;
  // Les toutes premieres secondes ne comptent pas dans le pire creux : une page
  // qui demarre est toujours irreguliere, et l'y inclure ferait mentir le
  // chiffre dans le sens pessimiste.
  if (maintenant > 4000) fpsMin = Math.min(fpsMin, fps);
  fpsTrames = 0; fpsDepuis = maintenant;
  return true;
}

let temoinSeq = null, temoinIndex = 0;
function afficherTemoin(seq, index = 0) {
  if (seq) { temoinSeq = seq; temoinIndex = index; }
  const s = temoinSeq;
  // La taille d'anneau se lit sur le SEGMENT courant : elle varie avec sa
  // densite d'images. L'ecran des faits n'a pas d'images, donc pas d'anneau.
  let detail = 'sans images';
  if (!s?.sansImage && SEQUENCES[temoinIndex]) {
    const f = fenetreDe(temoinIndex);
    detail = `anneau ${f.taille}, fenetre ${f.devant}+${f.derriere}`;
  }
  const cadence = fps
    ? `${fps.toFixed(0)} img/s (creux ${Number.isFinite(fpsMin) ? fpsMin.toFixed(0) : '—'}) — `
    : '';
  // L'etat de l'eau ne s'affiche que sur la piscine : ailleurs il ne veut rien
  // dire, et le temoin doit rester lisible sur un ecran de telephone.
  const eau = s?.eau ? ` — ${bassinEtat}` : '';
  temoin.textContent = estDegrade()
    ? `${cadence}degrade ${jeu}px — ${raisonDegrade()} — 1/${cfg.pasImage}, ${detail}${eau} — ${s ? s.id : ''}`
    : `${cadence}normal ${jeu}px — ${detail}${eau} — ${s ? s.id : ''}`;
  temoin.dataset.degrade = String(estDegrade());
  temoin.dataset.bas = String(fps > 0 && fps < 30);
}

/**
 * Le libelle du canvas suit la sequence, pour un lecteur d'ecran.
 *
 * Le TEXTE, lui, n'est plus ici : il est porte par la narration, dont
 * l'opacite est une fonction de la position et se recalcule a chaque trame.
 */
let ecranAffiche = null;
function afficherTexte(seq) {
  if (seq.ecran === ecranAffiche) return;
  ecranAffiche = seq.ecran;
  // Les titres sont en attente du client. Tant qu'ils manquent, l'identifiant
  // de sequence vaut mieux qu'un libelle vide pour un lecteur d'ecran.
  canvas.setAttribute('aria-label', seq.titre || seq.id);
}

// La bascule du mode degrade survient EN COURS DE VISITE. Detruire les anneaux
// a cet instant vidait celui qu'on affichait : l'image se figeait net et ne
// revenait jamais. On reconfigure donc en place, sans jeter une image decodee.
surBascule(() => {
  cfg = reglages();
  fenetres.clear();
  for (const [i, a] of anneaux) {
    a.reconfigurer({ taille: fenetreDe(i).taille, pasImage: cfg.pasImage });
  }
  afficherTemoin(SEQUENCES[segmentVu], segmentVu);
});

// Le segment affiche, retenu pour que le temoin reste juste apres une bascule.
let segmentVu = 0;

// ---------------------------------------------------------------------------
// Mouvement reduit : une image choisie par sequence, et rien qui bouge.
// Ce n'est pas une punition, c'est une version : elle doit rester belle.
// ---------------------------------------------------------------------------
async function modeFixe() {
  document.documentElement.dataset.mode = 'fixe';
  rendu.redimensionner();
  const seq = SEQUENCES[0];
  afficherTexte(seq);
  afficherTemoin(seq);
  narration.poserFixe(seq);
  const a = anneauPour(0);
  await a.assurer(seq.imageFixe);
  rendu.peindre(a.image(seq.imageFixe));
  // Les faits ferment la page ici aussi : tout est la, tout de suite, et rien
  // ne bouge. Sans cet appel ils resteraient a opacite nulle, donc invisibles.
  faits.poserFixe();
  addEventListener('resize', () => {
    rendu.redimensionner();
    rendu.peindre(a.image(seq.imageFixe));
  }, { passive: true });
}

// ---------------------------------------------------------------------------
// Parcours.
// ---------------------------------------------------------------------------
async function modeParcours() {
  document.documentElement.dataset.mode = 'parcours';

  const defilement = creerDefilement({ longueurTotale: () => carte.longueurTotale() });

  // Les octets de l'amorce partent MAINTENANT, pendant que le visiteur lit les
  // deux boutons. Au clic il ne reste plus qu'un decodage, et le son du logo
  // peut tomber pile sur sa premiere image au lieu d'attendre le reseau. Un
  // `fetch` ne fait aucun bruit, donc la regle « aucun son sans clic » tient.
  prechargerAmorce();

  // La Porte tient l'ecran jusqu'a la fin de l'amorce. Le defilement n'est
  // active qu'a ce moment-la : pendant l'ouverture, la molette ne fait rien.
  const porte = creerPorte({
    racine: document.getElementById('porte'),
    choix: document.getElementById('porte-choix'),
    logo: document.getElementById('porte-logo'),
    voile: document.getElementById('porte-voile'),
    indice: document.getElementById('indice'),
    surSon: async (avecSon) => {
      if (!avecSon) return;
      // L'AMORCE D'ABORD, ET SANS L'ATTENDRE.
      //
      // `activerSon` charge et decode les nappes de toutes les scenes :
      // plusieurs secondes au premier passage. Appelee APRES, l'amorce arrivait
      // longtemps apres le logo qu'elle accompagne. Elle part donc en tete,
      // programmee sur l'horloge AUDIO a l'instant exact ou le nom commence a
      // paraitre -- les deux tombent ensemble, ce qui est tout le sujet de
      // cette ouverture.
      //
      // Non attendue non plus : une amorce muette ne doit pas empecher le reste
      // du son de s'ouvrir.
      jouerAmorce({ retard: INTRO_LOGO_ENTREE })
        .catch((e) => console.warn('amorce muette : ' + e.message));
      if (!vumetre) vumetre = creerVumetre(barres);
      await activerSon(OUVERTURE_SON);
    },
    surFin: () => {
      defilement.activer();
      // Le premier geste du visiteur retire l'indice.
      for (const ev of ['wheel', 'touchstart', 'keydown']) {
        addEventListener(ev, () => porte.masquerIndice(), { once: true, passive: true });
      }
    },
  });

  rendu.redimensionner();
  afficherTexte(SEQUENCES[0]);
  afficherTemoin(SEQUENCES[0]);

  // Premiere image tout de suite, en fixe : aucun ecran vide, aucun
  // pourcentage, aucune attente devant un prechargeur.
  const a0 = anneauPour(0);
  await a0.assurer(1);
  rendu.peindre(a0.image(1));


  addEventListener('resize', () => {
    rendu.redimensionner();
    carte.remesurer();
    defilement.remesurer();
    // Les tampons sont calcules en pixels de defilement : un changement de
    // hauteur de fenetre les invalide tous.
    fenetres.clear();
  }, { passive: true });

  let dernierTemps = performance.now();
  let derniereImage = null;
  let premierRenduMesure = false;
  let segmentAvant = -1;

  function trame(maintenant) {
    requestAnimationFrame(trame);

    let dt = (maintenant - dernierTemps) / 1000;
    dernierTemps = maintenant;
    if (!(dt > 0)) dt = 0;
    else if (dt > 0.05) dt = 0.05;   // onglet revenu d'arriere-plan
    signalerTrame(dt * 1000, maintenant);
    if (compterTrame(maintenant)) afficherTemoin(null);
    porte.trame(maintenant);
    if (vumetre) vumetre.trame(maintenant, estOuvert());
    curseur.trame(maintenant);

    const { position, vitesse } = defilement.avancer(dt);
    const { index, seq, t } = carte.resoudre(position);

    if (index !== segmentAvant) {
      segmentAvant = index;
      segmentVu = index;
      elaguer(carte.voisinage(index));
      afficherTexte(seq);
      afficherTemoin(seq, index);
      scenesBasculer(index);
    }

    // -- L'ecran des faits ---------------------------------------------------
    // Dernier segment de la carte, et le seul sans images. On sort ici : tout
    // ce qui suit -- anneaux, prefetch, bassin, fondus, luminosite -- parle
    // d'images qu'il n'a pas.
    if (seq.sansImage) {
      // ON NE TOUCHE PAS AUX CANVAS ICI, et c'est la correction d'un defaut
      // visible : rendre la main au canvas 2D revelait l'image qu'il tenait
      // encore, c'est-a-dire la piscine EN PLEIN JOUR -- la derniere qu'il ait
      // peinte, avant que le bassin WebGL ne prenne le relais au fondu
      // d'entree.
      //
      // Le noir des faits ne s'installe que sur les seize premiers pour cent du
      // segment. Pendant cette demi-hauteur d'ecran, le visiteur voyait donc la
      // piscine repasser de la nuit au plein jour avant de disparaitre.
      //
      // Il n'y a rien a echanger : l'ecran des faits est un voile opaque
      // par-dessus, et ce qu'il couvre doit simplement rester ce que le
      // visiteur regardait a l'instant d'avant.
      faits.poser(t);
      narration.poser(seq, t);
      return;
    }
    faits.poser(null);

    const anneau = anneauPour(index);
    const i = imageA(seq, t);
    anneau.pourvoir(i, Math.sign(vitesse), fenetreDe(index));

    // Les voisins s'alimentent a chaque trame tant qu'ils ne sont pas amorces,
    // et non une seule fois a la frontiere : creer un anneau ne le remplit pas,
    // et un franchissement rapide arriverait avant la fin du decodage.
    alimenterVoisins(carte.voisinage(index), index, anneauPour,
                     (k) => SEQUENCES[k].frames);

    const bmp = anneau.image(i);

    // Le fondu ENCHAINE d'entree : sur la premiere part du segment, la derniere
    // image du clip precedent reste dessous et celui-ci monte par-dessus.
    const partFondu = seq.fonduEnchaine ?? PART_FONDU_ENCHAINE;

    // -- Le bassin de la piscine ---------------------------------------------
    // La derniere sequence est rendue par WebGL et non par le canvas 2D : elle
    // dessine la plaque elle-meme et n'en deforme que la zone du bassin.
    //
    // Il ne prend PAS l'ecran pendant le fondu d'entree : le bassin ne sait
    // melanger que la houle, pas deux clips.
    let rendupParBassin = false;
    if (index === SEQUENCES.length - 1 && seq.eau && bmp && t >= partFondu) {
      const b = bassinPour();
      if (b) {
        if (canvasEau.hidden) { canvasEau.hidden = false; canvas.hidden = true; }
        // La houle MONTE au lieu d'apparaitre. A force nulle le bassin rend la
        // plaque intacte, donc l'echange des deux canvas ne se voit pas.
        const force = Math.min((t - partFondu) / EVEIL_BASSIN, 1);
        // On passe l'index d'image normalise, PAS la progression du defilement :
        // les reperes de calage sont poses sur des images.
        // On CROIT LA VALEUR DE RETOUR plutot que de supposer que ca a marche :
        // si le contexte a saute pendant cette trame meme, le bassin le dit et
        // le canvas 2D reprend la main tout de suite, dans la meme trame.
        rendupParBassin = b.trame(bmp, indexNormalise(seq, t), dt,
                                  (v) => eauSuivre(index, v), { force }) !== false;
        if (rendupParBassin) { rendu.reglerLuminosite(1); bassinADessine = true; }
        else derniereImage = null;   // le canvas 2D doit se repeindre
      }
    }
    if (!rendupParBassin) {
      if (!canvasEau.hidden) { canvasEau.hidden = true; canvas.hidden = false; }
      // [SON] Sans bassin, personne ne peut plus toucher l'eau, donc personne
      // ne peut plus la faire taire. On le dit explicitement a chaque trame.
      eauSuivre(index, null);
    }

    const enFondu = index > 0 && t < partFondu;

    if (bmp && !rendupParBassin) {
      const avant = performance.now();
      if (enFondu) {
        const precedent = anneaux.get(index - 1);
        const seqP = SEQUENCES[index - 1];
        const bmpP = precedent ? precedent.image(bornesDe(seqP)[1]) : null;
        rendu.peindreFondu(bmpP, bmp, t / partFondu);
        derniereImage = null;          // le fondu bouge a chaque trame
      } else if (bmp !== derniereImage) {
        rendu.peindre(bmp);
        derniereImage = bmp;
      }
      if (!premierRenduMesure) {
        premierRenduMesure = true;
        evaluerPremierRendu(performance.now() - avant);
      }
    }

    if (!rendupParBassin) {
      rendu.reglerLuminosite(luminositePour(seq, t, {
        premiere: premiere(seq), derniere: derniere(seq),
      }));
    }

    // La narration se pose APRES l'image : son opacite est une fonction de la
    // position, comme la luminosite des raccords, et elle se recalcule a chaque
    // trame plutot que de suivre une horloge.
    narration.poser(seq, t);

    scenesMelanger(index, t, Math.round(i),
                   { vitesse, dt, imageGlobale: imageGlobale(seq.id, Math.round(i)) });
  }

  requestAnimationFrame(trame);
}

(mouvementReduit ? modeFixe() : modeParcours());
