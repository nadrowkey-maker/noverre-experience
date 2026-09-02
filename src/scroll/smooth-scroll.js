// Le moteur de defilement, a impulsions.
//
// Le defilement natif est desactive : la molette et le doigt n'ont plus d'effet
// propre, ils ajoutent de la vitesse a un integrateur. Deux filtres en serie
// produisent la sensation — l'amortissement fait glisser apres qu'on a lache,
// le lissage adoucit le depart — et c'est la paire qui la produit, pas l'un des
// deux.
//
// Ce que ce choix coute, et qu'il faut donc rendre : le clavier. Sans
// defilement natif, Espace, Page suivante, les fleches, Debut et Fin ne font
// plus rien, alors que le brief exige une navigation clavier complete. Ils sont
// reimplantes ici, dans le meme integrateur, pour que la glisse s'y applique
// aussi et qu'une touche ne produise pas un saut sec.

import {
  AMORTISSEMENT, LISSAGE, GAIN_MOLETTE, GAIN_TACTILE,
  IMPULSION_FLECHE, IMPULSION_PAGE, VITESSE_MAX,
} from '../config/constants.js';

export function creerDefilement({ longueurTotale }) {
  let position = 0;
  let velocite = 0;     // px/s accumules par les impulsions
  let appliquee = 0;    // px/s reellement appliques, version lissee
  let total = longueurTotale();
  let actif = false;    // rien ne bouge avant que la premiere image soit la

  function impulsion(px) {
    if (!actif) return;
    velocite = Math.max(-VITESSE_MAX, Math.min(VITESSE_MAX, velocite + px));
    // Ne rien accumuler contre une extremite : sinon le visiteur pousse dans le
    // vide et la page repart en retard quand il change de sens.
    if (position <= 0 && velocite < 0) velocite = 0;
    if (position >= total && velocite > 0) velocite = 0;
  }

  // --- molette ---------------------------------------------------------------
  function surMolette(e) {
    e.preventDefault();
    let d = e.deltaY;
    if (e.deltaMode === 1) d *= 16;                    // lignes
    else if (e.deltaMode === 2) d *= window.innerHeight; // pages
    impulsion(d * GAIN_MOLETTE);
  }

  // --- tactile ---------------------------------------------------------------
  let doigtY = null;
  const surTouchStart = (e) => { doigtY = e.touches[0].clientY; };
  function surTouchMove(e) {
    e.preventDefault();
    if (doigtY === null) return;
    const y = e.touches[0].clientY;
    impulsion((doigtY - y) * GAIN_TACTILE);
    doigtY = y;
  }
  const finDoigt = () => { doigtY = null; };

  // --- clavier ---------------------------------------------------------------
  function surTouche(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const h = window.innerHeight;
    let d = 0;
    switch (e.key) {
      case 'ArrowDown': case 'ArrowRight': d = h * IMPULSION_FLECHE; break;
      case 'ArrowUp':   case 'ArrowLeft':  d = -h * IMPULSION_FLECHE; break;
      case 'PageDown':                     d = h * IMPULSION_PAGE; break;
      case 'PageUp':                       d = -h * IMPULSION_PAGE; break;
      case ' ':                            d = (e.shiftKey ? -1 : 1) * h * IMPULSION_PAGE; break;
      // Debut et Fin sautent, ils ne poussent pas : c'est leur role.
      case 'Home': e.preventDefault(); position = 0; velocite = appliquee = 0; return;
      case 'End':  e.preventDefault(); position = total; velocite = appliquee = 0; return;
      default: return;
    }
    e.preventDefault();
    impulsion(d * GAIN_MOLETTE);
  }

  window.addEventListener('wheel', surMolette, { passive: false });
  window.addEventListener('touchstart', surTouchStart, { passive: true });
  window.addEventListener('touchmove', surTouchMove, { passive: false });
  window.addEventListener('touchend', finDoigt, { passive: true });
  window.addEventListener('touchcancel', finDoigt, { passive: true });
  window.addEventListener('keydown', surTouche, { passive: false });

  /** Avance d'une trame. Renvoie la position et la vitesse instantanees. */
  function avancer(dt) {
    velocite *= Math.exp(-AMORTISSEMENT * dt);
    if (Math.abs(velocite) < 0.5) velocite = 0;

    appliquee += (velocite - appliquee) * (1 - Math.exp(-LISSAGE * dt));
    if (Math.abs(appliquee) < 0.5 && velocite === 0) appliquee = 0;

    position += appliquee * dt;
    if (position < 0) { position = 0; velocite = appliquee = 0; }
    else if (position > total) { position = total; velocite = appliquee = 0; }

    return { position, vitesse: appliquee };
  }

  return {
    avancer,
    activer: () => { actif = true; },
    /** Le redimensionnement change la longueur : on conserve la progression. */
    remesurer() {
      const p = total > 0 ? position / total : 0;
      total = longueurTotale();
      position = p * total;
    },
    get total() { return total; },
    get position() { return position; },
  };
}
