// La narration — la couche qui fait d'une suite de plans un parcours.
//
// CE QU'ELLE N'EST PAS. Elle ne decrit jamais ce qui est a l'ecran : l'image le
// fait deja. Elle dit ce que l'image ne peut pas dire -- l'heure, l'habitude,
// la consequence, ce qui se passe quand personne ne regarde. Aucun nom de
// piece, aucune surface, aucun sous-titre explicatif. Si l'on ressent le besoin
// d'ecrire « Spa » sur l'ecran du spa, c'est le signe que le systeme marche :
// l'image suffit.
//
// L'OPACITE SUIT LE DEFILEMENT, JAMAIS UNE HORLOGE.
//
// C'est la meme regle que le son et que la luminosite des raccords : le
// visiteur controle tout, donc le texte aussi. Aucun `setTimeout`, aucune
// transition CSS temporelle, aucune animation -- l'opacite est une FONCTION DE
// LA POSITION, recalculee a chaque trame.
//
// La consequence est voulue : si le visiteur s'arrete au milieu de la rampe, le
// texte reste a mi-opacite et y reste. C'est correct.
//
//   rampe d'entree   0,06 de segment
//   plein            `tenue`
//   rampe de sortie  0,08 de segment
//
// AUCUN DEPLACEMENT. Opacite seule : pas de translation verticale, pas de fondu
// par lettre. L'image bouge deja dessous, et un second mouvement entrerait en
// concurrence avec elle -- les deux y perdraient.
//
// LE VOILE N'EXISTE QUE QUAND LE TEXTE EST LA. Son opacite est la meme fonction
// de la position, multipliee par son maximum. L'image n'est donc jamais
// assombrie quand il n'y a rien a lire.

/** Part de segment sur laquelle le texte monte. */
const RAMPE_ENTREE = 0.06;
/** Part de segment sur laquelle il se retire. */
const RAMPE_SORTIE = 0.08;

/**
 * Noircissement maximum du voile.
 *
 * 0,35. Le bas gauche des treize plans va du noir franc au blanc : sombre sur
 * le spa, les velos et le yoga, franchement clair sur la salle de sport et sur
 * la piscine, ou le travertin est en plein soleil. Un texte clair y serait
 * illisible sans voile.
 *
 * Verifie comme le curseur l'a ete (§9, piege 29) : ecart de luminance d'au
 * moins 0,20 sur les treize fonds. Voir tools/mesure-contraste-narration.py.
 */
export const VOILE_MAX = 0.35;

const borne = (v) => Math.min(Math.max(v, 0), 1);
/** Lissage cubique : la rampe n'a d'a-coup a aucun de ses deux bouts. */
const doux = (u) => u * u * (3 - 2 * u);

/**
 * L'opacite du texte d'un segment a la progression `t`.
 *
 * @param {object} n  le bloc `narration` de la sequence
 * @param {number} t  progression dans le segment, 0 a 1
 * @param {boolean} sansRampe mouvement reduit : plein des l'entree dans la
 *   fenetre, et il ne disparait pas. Cette version doit rester belle -- c'est
 *   une version, pas une punition.
 */
export function opacitePour(n, t, sansRampe = false) {
  if (!n) return 0;
  const debut = n.a - RAMPE_ENTREE;
  if (t < debut) return 0;
  if (sansRampe) return 1;
  if (t < n.a) return doux(borne((t - debut) / RAMPE_ENTREE));
  // `persistant` : elle monte et elle RESTE. C'est une consigne, pas une
  // legende -- elle doit rester lisible tant que le visiteur joue avec l'eau.
  if (n.persistant) return 1;
  const finPlein = n.a + (n.tenue ?? 0);
  if (t <= finPlein) return 1;
  return 1 - doux(borne((t - finPlein) / RAMPE_SORTIE));
}

/**
 * @param {HTMLElement} racine  le conteneur, aligne sur la bande d'image
 * @param {HTMLElement} ligne   le paragraphe qui porte le texte
 * @param {HTMLElement} voile   le degrade du tiers inferieur
 */
export function creerNarration(racine, ligne, voile) {
  const sansRampe = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let idAffiche = null;
  let opaciteAffichee = -1;

  return {
    /**
     * @param {object} seq la sequence courante, ou null pour tout effacer
     * @param {number} t   progression dans le segment
     */
    poser(seq, t) {
      const n = seq?.narration;

      // LE TEXTE EST ECRIT DANS LE DOM DES LE CHANGEMENT DE SEGMENT, et non
      // quand il devient visible : un lecteur d'ecran doit le trouver meme
      // peint par-dessus une image, et meme a opacite nulle. Regle non
      // negociable.
      if ((seq?.id ?? null) !== idAffiche) {
        idAffiche = seq?.id ?? null;
        ligne.textContent = n?.texte ?? '';
        racine.hidden = !n;
      }
      if (!n) return;

      const o = opacitePour(n, t, sansRampe);
      // On n'ecrit que si la valeur change : le style est un point de contact
      // avec la mise en page, et le toucher a chaque trame pour rien coute des
      // recalculs qu'on peut s'epargner.
      if (Math.abs(o - opaciteAffichee) < 0.002) return;
      opaciteAffichee = o;
      const v = o.toFixed(3);
      ligne.style.opacity = v;
      voile.style.opacity = (o * VOILE_MAX).toFixed(3);
      // `aria-hidden` suit la visibilite REELLE : un lecteur d'ecran ne doit
      // pas annoncer une ligne que personne ne voit encore.
      ligne.setAttribute('aria-hidden', String(o < 0.02));
    },

    /** Mouvement reduit : le texte de la sequence montree, a pleine opacite. */
    poserFixe(seq) {
      const n = seq?.narration;
      idAffiche = seq?.id ?? null;
      ligne.textContent = n?.texte ?? '';
      racine.hidden = !n;
      if (!n) return;
      ligne.style.opacity = '1';
      voile.style.opacity = String(VOILE_MAX);
      ligne.setAttribute('aria-hidden', 'false');
    },
  };
}
