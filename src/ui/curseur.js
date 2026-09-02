// Le curseur.
//
// Un anneau qui suit le pointeur avec un leger retard, et qui s'ouvre au-dessus
// de ce qui se clique. Le retard est le sujet : sans lui l'anneau est une
// decalcomanie du pointeur natif et n'apporte rien. Avec, la main sent qu'elle
// deplace quelque chose qui a un poids -- la meme idee que la glisse du
// defilement, appliquee au pointeur.
//
// Il se retire de lui-meme la ou il n'a pas de sens : sur un appareil tactile
// il n'y a pas de pointeur, et en mouvement reduit un element qui poursuit la
// main en permanence est exactement ce que le reglage demande d'eviter.

/**
 * Constante de temps du suivi, en secondes.
 *
 * 0,055 : assez pour qu'on percoive une inertie, assez court pour que l'anneau
 * ne soit jamais en retard au moment de cliquer. Au-dela de 0,1 s il devient
 * genant, en dessous de 0,03 s l'effet disparait.
 */
const TAU = 0.055;

export function creerCurseur(element) {
  const grossier = matchMedia('(hover: none), (pointer: coarse)').matches;
  const mouvementReduit = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (grossier || mouvementReduit) return { trame() {} };

  document.documentElement.dataset.curseur = 'perso';

  let cibleX = innerWidth / 2, cibleY = innerHeight / 2;
  let x = cibleX, y = cibleY;
  let dernier = performance.now();
  let vu = false;

  addEventListener('pointermove', (e) => {
    cibleX = e.clientX; cibleY = e.clientY;
    // L'anneau se REMONTRE a chaque mouvement, et pas seulement au premier.
    //
    // C'etait un vrai defaut : `pointerleave` et `blur` le masquent -- a juste
    // titre, un anneau qui reste au milieu de l'ecran quand on a change de
    // fenetre n'a aucun sens -- mais il n'etait rallume que dans le `if (!vu)`,
    // qui n'est vrai qu'une fois. Le premier passage sur un autre onglet le
    // faisait donc disparaitre POUR TOUJOURS, et comme le curseur natif est
    // masque par `cursor: none`, il ne restait plus rien du tout a l'ecran.
    element.dataset.actif = 'oui';
    // Le verrou ne sert plus qu'a une chose : ne pas faire glisser l'anneau
    // depuis le milieu de l'ecran au tout premier mouvement.
    if (!vu) { vu = true; x = cibleX; y = cibleY; }
    // Ce qui se clique ouvre l'anneau : c'est la seule information qu'il porte,
    // et elle remplace le changement de curseur que l'on vient de supprimer.
    const sous = e.target instanceof Element ? e.target.closest('button, a, [role="button"]') : null;
    element.dataset.survol = sous ? 'oui' : 'non';
  }, { passive: true });

  addEventListener('pointerleave', () => { element.dataset.actif = 'non'; }, { passive: true });
  addEventListener('blur', () => { element.dataset.actif = 'non'; });

  return {
    trame(maintenant) {
      const dt = Math.min((maintenant - dernier) / 1000, 0.1);
      dernier = maintenant;
      // Approche exponentielle, independante de la cadence d'affichage : la
      // meme loi que le defilement et que les gains du son.
      const alpha = 1 - Math.exp(-dt / TAU);
      x += (cibleX - x) * alpha;
      y += (cibleY - y) * alpha;
      element.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    },
  };
}
