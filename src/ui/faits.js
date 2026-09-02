// L'ecran des faits — le dernier de la page.
//
// Apres quatre minutes de lieu, on donne les chiffres. C'est le seul ecran qui
// ne montre rien : du texte sur noir, aucun son. Le silence y est la chose la
// plus forte de la page, et il n'existe que parce que le bassin s'est vide
// juste avant.
//
// Il se PARCOURT comme le reste. Le brief interdit le defilement par cran
// d'ecran entier : les faits ne peuvent donc pas surgir d'un bloc, ils se
// decouvrent a la main du visiteur, ligne apres ligne.
//
// Le texte est ecrit une fois, au demarrage, et vit dans le DOM du premier au
// dernier instant : un lecteur d'ecran le trouve, un moteur de recherche
// aussi, meme quand il n'est pas peint.

import { FAITS, TYPOLOGIES, SURFACES, PROMOTEUR_NOM, PROMOTEUR_URL }
  from '../config/sequences.js';

/** Part du segment sur laquelle le noir s'installe avant la premiere ligne. */
const NOIR = 0.16;
/** Part du segment sur laquelle les lignes finissent d'arriver. */
const LEVEE = 0.72;
/** Decalage d'une ligne a la suivante, en part de la levee. */
const DECALAGE = 0.055;

const borne = (v) => Math.min(Math.max(v, 0), 1);
const doux = (u) => u * u * (3 - 2 * u);

/**
 * Construit les lignes reellement affichables.
 *
 * Les trois valeurs entre crochets sont en attente du client. Tant qu'elles
 * valent null, la ligne qui les porte n'est PAS ecrite : le brief interdit le
 * texte de remplissage, et une ligne « [typologies] » livree au client serait
 * exactement cela. Le jour ou la valeur arrive, la ligne apparait seule.
 */
function lignes() {
  const dehors = [];
  for (const brute of FAITS.lignes) {
    if (brute !== null) { dehors.push({ texte: brute }); continue; }

    // Les deux emplacements a remplir, dans l'ordre ou ils sont declares.
    if (!dehors.some((l) => l.role === 'surfaces')) {
      if (TYPOLOGIES && SURFACES) {
        dehors.push({ role: 'surfaces', texte: `${TYPOLOGIES} · ${SURFACES}`, fort: true });
      } else {
        dehors.push({ role: 'surfaces', absent: true });
      }
    } else if (PROMOTEUR_URL && PROMOTEUR_NOM) {
      dehors.push({ role: 'lien', texte: PROMOTEUR_NOM, lien: PROMOTEUR_URL });
    } else {
      dehors.push({ role: 'lien', absent: true });
    }
  }
  return dehors.filter((l) => !l.absent);
}

export function creerFaits(racine, hote) {
  const elements = [];

  lignes().forEach((l, k) => {
    // La premiere ligne est le nom : c'est un titre, et il doit en avoir la
    // nature dans le document, pas seulement la taille.
    const el = document.createElement(k === 0 ? 'h2' : 'p');
    if (l.fort) el.className = 'fort';
    if (l.lien) {
      const a = document.createElement('a');
      a.href = l.lien; a.textContent = l.texte;
      a.rel = 'noopener'; a.target = '_blank';
      el.append(a);
    } else {
      el.textContent = l.texte;
    }
    hote.append(el);
    elements.push(el);
  });

  let vuAvant = -1;

  return {
    /** Nombre de lignes reellement ecrites. Sert au controle de livraison. */
    get nombre() { return elements.length; },

    /**
     * @param {number|null} t progression dans le segment, ou null si le
     *   visiteur n'y est pas. `null` referme l'ecran d'un coup.
     */
    poser(t) {
      const actif = t !== null;
      const global = actif ? doux(borne(t / NOIR)) : 0;

      // On n'ecrit dans le style que lorsque quelque chose a change : cet ecran
      // est immobile la plupart du temps, et repeindre une opacite identique a
      // chaque trame reveillerait le compositeur pour rien.
      if (global !== vuAvant) {
        vuAvant = global;
        racine.style.opacity = global.toFixed(3);
        racine.dataset.vu = global > 0.99 ? 'oui' : 'non';
        // `inert` retire le lien du parcours clavier tant que l'ecran n'est pas
        // la : un lien invisible qu'on peut atteindre au tabulateur est un
        // piege, pas une facilite.
        if (global > 0.99) racine.removeAttribute('inert');
        else racine.setAttribute('inert', '');
      }

      if (!actif) return;
      elements.forEach((el, k) => {
        const debut = NOIR + k * DECALAGE * LEVEE;
        el.style.setProperty('--vu', doux(borne((t - debut) / (LEVEE * 0.5))).toFixed(3));
      });
    },

    /** Mouvement reduit : tout est la, tout de suite, et rien ne bouge. */
    poserFixe() {
      racine.style.opacity = '1';
      racine.dataset.vu = 'oui';
      racine.removeAttribute('inert');
      elements.forEach((el) => el.style.setProperty('--vu', '1'));
    },
  };
}
