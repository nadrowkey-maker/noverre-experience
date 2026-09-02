// Le contexte et le bus principal.
//
// Web Audio natif, aucune bibliotheque. Le brief l'impose, et c'est aussi le
// bon choix : tout ce que fait cette page est du melange de gains et de
// filtres, ce que l'API fait nativement et sans intermediaire.
//
// Aucun son ne demarre sans clic explicite. Le contexte est cree suspendu et
// n'est repris que par un geste du visiteur : c'est une regle du brief, et
// c'est aussi ce que les navigateurs imposent de toute facon. Faire de cette
// contrainte le premier ecran fait arriver la plupart des visiteurs en ayant
// choisi d'ecouter.

let ctx = null;
let maitre = null;
let actif = false;
const abonnes = new Set();

export function contexte() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    maitre = ctx.createGain();
    maitre.gain.value = 0;
    maitre.connect(ctx.destination);
  }
  return ctx;
}

export const bus = () => { contexte(); return maitre; };

/**
 * Ouvre le son. A n'appeler que depuis un geste du visiteur.
 *
 * La duree est un ARGUMENT parce que les deux ouvertures n'ont pas le meme
 * role. Depuis la porte, le parc doit se reveler et non demarrer : c'est une
 * entree dans un lieu. Depuis la bascule en cours de visite, elle doit etre
 * breve, sinon le bouton semble ne pas repondre.
 */
export async function ouvrir(duree = 0.4) {
  const c = contexte();
  if (c.state === 'suspended') await c.resume();
  actif = true;
  maitre.gain.cancelScheduledValues(c.currentTime);
  maitre.gain.setTargetAtTime(1, c.currentTime, duree / 3);
  abonnes.forEach((f) => f(true));
}

/** Coupe le son sans arreter les pistes : elles continuent a leur horloge. */
export function fermer() {
  if (!ctx) return;
  actif = false;
  maitre.gain.cancelScheduledValues(ctx.currentTime);
  maitre.gain.setTargetAtTime(0, ctx.currentTime, 0.25 / 3);
  abonnes.forEach((f) => f(false));
}

/**
 * L'amorce : le son du logo, une seule fois, au clic sur « entrer avec le son ».
 *
 * C'est une signature sonore a l'ouverture, ce que le document de la bande
 * sonore deconseille explicitement -- il reserve ce role au son du comptoir.
 * Le choix est assume et documente (voir D11) : cette amorce est ce qui fait
 * entrer dans un univers plutot qu'ouvrir une page, et elle vaut son cout.
 *
 * Elle ne passe PAS par le bus principal. Si elle y passait, la bascule silence
 * la couperait au milieu, alors qu'elle est le seul son de la page dont on ne
 * peut pas sortir a moitie.
 */
let amorceJouee = false;
let amorceOctets = null;

/**
 * Va chercher les octets de l'amorce SANS toucher au contexte audio.
 *
 * A appeler au chargement de la page. Un simple `fetch` ne fait aucun bruit et
 * ne cree aucun contexte : la regle « aucun son sans clic explicite » tient.
 * Le decodage, lui, attend le clic -- il a besoin du contexte.
 */
export function prechargerAmorce(fichier = '/audio/logo.mp3') {
  amorceOctets ||= fetch(fichier).then((r) => {
    if (!r.ok) throw new Error(`amorce : ${r.status}`);
    return r.arrayBuffer();
  });
  return amorceOctets;
}

/**
 * L'amorce, programmee A L'INSTANT EXACT ou le logo commence a paraitre.
 *
 * `retard` se compte depuis MAINTENANT et se programme sur l'horloge AUDIO, pas
 * sur celle du JavaScript. C'est la seule facon de tomber juste : le tampon se
 * decode pendant ce temps-la, et le decodage ne dure pas le meme temps a chaque
 * visite.
 *
 * Elle ne passe PAS par le bus principal. Si elle y passait, la bascule silence
 * la couperait au milieu, alors qu'elle est le seul son de la page dont on ne
 * peut pas sortir a moitie.
 */
export async function jouerAmorce({ retard = 0, db = -3 } = {}) {
  if (amorceJouee) return;
  amorceJouee = true;
  const c = contexte();
  // Le contexte est repris ICI, avant tout le reste : `currentTime` n'avance
  // pas tant qu'il est suspendu, et l'instant vise serait calcule sur une
  // horloge arretee.
  if (c.state === 'suspended') await c.resume();
  const vise = c.currentTime + retard;

  const buf = await c.decodeAudioData(await prechargerAmorce());
  const g = c.createGain();
  g.gain.value = Math.pow(10, db / 20);
  const src = c.createBufferSource();
  src.buffer = buf;
  src.connect(g).connect(c.destination);
  // Si le decodage a depasse l'instant vise -- premiere visite, cache froid --
  // on part tout de suite plutot que de programmer dans le passe, ce que Web
  // Audio traduirait par un demarrage immediat de toute facon, mais sans qu'on
  // sache que le budget a ete depasse.
  src.start(Math.max(vise, c.currentTime));
}

export const estOuvert = () => actif;
export const basculer = () => (actif ? fermer() : ouvrir());
export const surBascule = (f) => { abonnes.add(f); return () => abonnes.delete(f); };
