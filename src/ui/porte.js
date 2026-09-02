// La Porte, et l'amorce.
//
// Le visiteur arrive sur du noir et deux mots. Il choisit d'entrer avec ou sans
// le son -- les navigateurs bloquent le son tant que personne ne le demande, et
// faire de cette contrainte le premier ecran fait arriver la plupart des
// visiteurs EN AYANT CHOISI d'ecouter, l'inverse exact d'une video qui demarre
// muette et le reste.
//
// Puis l'ecran redevient noir et l'amorce commence : le logo arrive sur une
// musique, grossit lentement, et le batiment monte du noir au drop. Le logo
// tient encore quelques secondes par-dessus l'image avant de s'effacer.
//
// Ces neuf secondes sont AUSSI le prechargeur. Le brief interdit le pourcentage
// et l'attente : ici il n'y a ni l'un ni l'autre, seulement une ouverture qui
// dure exactement le temps qu'il faut pour amorcer les premieres sequences.

import {
  INTRO_LOGO_ENTREE, INTRO_LOGO_FONDU,
  INTRO_LOGO_ECHELLE_DEBUT, INTRO_LOGO_ECHELLE_FIN,
  INTRO_DROP, INTRO_DROP_FONDU,
  INTRO_LOGO_SORTIE, INTRO_LOGO_SORTIE_FONDU, INTRO_FIN,
  INTRO_FACTEUR_SILENCE, INTRO_LOGO_FLOU, INTRO_LOGO_NET,
  PORTE_SORTIE_CHOIX,
} from '../config/constants.js';

const borne = (v) => Math.min(Math.max(v, 0), 1);
/** Rampe de a vers b sur une duree, en douceur aux deux bouts. */
function rampe(t, debut, duree) {
  const u = borne((t - debut) / duree);
  return u * u * (3 - 2 * u);          // lissage cubique, sans a-coup
}

export function creerPorte({ racine, choix, logo, voile, indice, surSon, surFin }) {
  let debutAmorce = null;
  let facteur = 1;
  let finie = false;

  /** Place le logo et le voile a l'instant `t` de l'amorce, en secondes. */
  function poser(t) {
    const e = INTRO_LOGO_ENTREE * facteur;
    const f = INTRO_LOGO_FONDU * facteur;
    const drop = INTRO_DROP * facteur;
    const dropF = INTRO_DROP_FONDU * facteur;
    const sortie = INTRO_LOGO_SORTIE * facteur;
    const sortieF = INTRO_LOGO_SORTIE_FONDU * facteur;
    const fin = INTRO_FIN * facteur;

    // Le logo : arrive en fondu, grossit lentement d'un bout a l'autre, puis
    // s'efface. Le grossissement est continu et ne s'arrete pas au drop : c'est
    // ce qui fait qu'il AVANCE au lieu de se poser.
    const apparu = rampe(t, e, f);
    const parti = rampe(t, sortie, sortieF);
    logo.style.opacity = (apparu * (1 - parti)).toFixed(3);

    const av = borne(t / fin);
    const ech = INTRO_LOGO_ECHELLE_DEBUT
      + (INTRO_LOGO_ECHELLE_FIN - INTRO_LOGO_ECHELLE_DEBUT) * av;

    // Le flou a sa PROPRE duree, bien plus longue que la montee d'opacite, et
    // il finit exactement sur le drop : le nom apparait vite mais met presque
    // six secondes a se former. L'image du batiment et la nettete du nom
    // arrivent alors au meme instant, sur le meme coup.
    const net = INTRO_LOGO_NET * facteur;
    const flou = INTRO_LOGO_FLOU * (1 - rampe(t, e, Math.max(net - e, 0.1)));
    logo.style.filter = `invert(1) blur(${flou.toFixed(2)}px)`;
    logo.style.transform =
      `translate(-50%, -50%) scale(${ech.toFixed(4)})`;

    // Le voile noir : opaque jusqu'au drop, puis il decouvre le batiment.
    voile.style.opacity = (1 - rampe(t, drop, dropF)).toFixed(3);

    if (!finie && t >= fin) {
      finie = true;
      racine.dataset.etat = 'fini';
      // Le logo vit hors de #porte, il ne disparait donc pas avec lui. On le
      // retire explicitement : un element en mix-blend-mode coute de la
      // composition a chaque trame, meme a opacite nulle.
      logo.style.display = 'none';
      // L'indice de defilement n'apparait qu'une fois l'amorce terminee : le
      // proposer pendant l'ouverture inviterait a la sauter.
      indice.hidden = false;
      surFin();
    }
  }

  function demarrer(avecSon) {
    facteur = avecSon ? 1 : INTRO_FACTEUR_SILENCE;
    racine.dataset.etat = 'amorce';

    // TOUT le contenu de l'accueil s'en va ENSEMBLE et EN FONDU : les deux
    // boutons, le casque et la phrase. `hidden` seul le faisait disparaitre
    // d'un coup, ce qui donnait un a-coup a l'instant precis ou l'amorce doit
    // prendre la main en douceur.
    //
    // On ne pose `hidden` qu'a la fin du fondu : le mettre tout de suite
    // couperait la transition, une regle `display: none` n'ayant rien a animer.
    choix.style.setProperty('--sortie', `${PORTE_SORTIE_CHOIX * 1000}ms`);
    choix.dataset.sortie = 'oui';
    setTimeout(() => { choix.hidden = true; }, PORTE_SORTIE_CHOIX * 1000);
    debutAmorce = performance.now();
    surSon(avecSon);
    poser(0);
  }

  for (const b of choix.querySelectorAll('button')) {
    b.addEventListener('click', () => demarrer(b.dataset.son === 'oui'));
  }

  return {
    /** A appeler a chaque trame tant que l'amorce n'est pas finie. */
    trame(maintenant) {
      if (debutAmorce === null || finie) return;
      poser((maintenant - debutAmorce) / 1000);
    },
    get enCours() { return debutAmorce !== null && !finie; },
    get demarree() { return debutAmorce !== null; },
    get terminee() { return finie; },
    /** Retire l'indice au premier geste du visiteur. */
    masquerIndice() { indice.hidden = true; },
  };
}
