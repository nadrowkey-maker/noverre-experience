// Le rideau — sequence sept, le seul mouvement de la piece.
//
// La boucle de frottement tourne EN PERMANENCE, a sa vitesse naturelle. Seul
// son volume suit la valeur absolue de la vitesse du rideau : ca glisse, on
// entend le tissu ; ca s'arrete, il n'y a plus rien. Le son ne change jamais
// de hauteur.
//
// Ne jamais piloter le fichier par la position du defilement : un scroll rapide
// accelererait la lecture et le rideau monterait en hauteur.
//
// L'extinction est FRANCHE, cinquante millisecondes. C'est le seul endroit de
// la page, avec l'eau du toit, ou le lissage se compte en centiemes et non en
// secondes : un rideau qui s'arrete s'arrete. Une extinction en une seconde
// ferait trainer le tissu apres que la main a lache, ce qui ne ressemble a
// rien de physique.
//
// Ce n'est pas une recompense comme la musique des velos, et ca ne lui vole
// donc rien : le visiteur deplace un objet et l'objet fait le bruit qu'il fait.
// C'est une consequence physique, et la seule preuve que sa main agit dans un
// ecran ou rien d'autre ne bouge.

import { contexte } from '../graph.js';
import { RIDEAU_T_EXTINCTION, TAU_GAIN } from '../../config/constants.js';
import { enLineaire } from '../tracks.js';

export async function creerRideau(cfg, banque) {
  const c = contexte();
  await banque.obtenir('rideau');

  let partAvant = null;
  // La vitesse du rideau est LISSEE avant de piloter le gain.
  //
  // Mesuree brute d'une trame a l'autre, elle saute : le defilement est lui-meme
  // discret, chaque cran de molette produit une bouffee puis une glisse, et
  // l'ecart d'image d'une trame a la suivante est bruite. Le gain suivait ce
  // bruit et l'on entendait un grattement, pas un tissu.
  //
  // 0,12 s : assez pour effacer le bruit de trame, assez court pour que le son
  // reste colle a la main. L'extinction, elle, garde ses cinquante
  // millisecondes -- c'est l'asymetrie qui fait qu'un rideau qui s'arrete
  // s'arrete.
  // Lissage ASYMETRIQUE. Le grattement vient des sautes vers le HAUT : on les
  // lisse. Mais lisser aussi la descente ferait trainer le son apres l'arret,
  // ce qui detruit exactement ce que ce rideau doit prouver -- un rideau qui
  // s'arrete s'arrete. La descente est donc presque instantanee.
  const TAU_MONTEE = 0.12;
  const TAU_DESCENTE = 0.02;
  let vitesseLissee = 0;

  return {
    /**
     * @param {number} image index d'image courant
     * @param {number} dt    duree de la trame, en secondes
     */
    suivre(image, dt) {
      // Ou en est le rideau, de 0 ferme a 1 ouvert.
      const part = Math.min(Math.max((image - cfg.de) / (cfg.a - cfg.de), 0), 1);

      if (partAvant === null || dt <= 0) { partAvant = part; return; }

      // Sa VITESSE, en parts par seconde. C'est elle qui commande le volume,
      // jamais la position.
      const brute = Math.abs(part - partAvant) / dt;
      partAvant = part;

      // Lissage exponentiel, independant de la cadence d'affichage.
      const tauV = brute > vitesseLissee ? TAU_MONTEE : TAU_DESCENTE;
      vitesseLissee += (brute - vitesseLissee) * (1 - Math.exp(-dt / tauV));

      // Une ouverture complete en une seconde vaut plein volume. Au-dela on
      // sature : un rideau ne crie pas parce qu'on tire plus vite.
      const niveau = Math.min(vitesseLissee, 1);
      // Racine carree : l'oreille entend le frottement bien avant que la main
      // n'ait atteint sa vitesse de croisiere. En lineaire, un mouvement lent
      // restait inaudible alors qu'il fait du bruit.
      const courbe = Math.sqrt(niveau);
      const db = niveau <= 0.005 ? -60 : cfg.db + (1 - courbe) * -14;

      // Montee douce, extinction franche. L'asymetrie est le sujet.
      const tau = niveau > 0.005 ? 0.10 : RIDEAU_T_EXTINCTION;
      banque.viser('rideau', db, tau);

      // Un rideau epais absorbe les aigus : la piste du dehors entendu de
      // l'interieur peut monter de deux ou trois decibels pendant l'ouverture,
      // pas plus. Personne ne le remarquera, tout le monde sentira que la piece
      // s'ouvre en meme temps que la lumiere entre.
      //
      // Le NOM de cette piste vient de la configuration et n'est plus ecrit
      // ici : sur Parkside c'etait `ville-interieure`, sur un site qui n'est
      // pas en ville c'est autre chose (§6.8), et un nom en dur rendait ce
      // module inutilisable ailleurs sans le rouvrir.
      if (cfg.dbDehorsOuvert !== undefined && cfg.pisteDehors) {
        const base = cfg.dbDehors ?? -36;
        banque.viser(cfg.pisteDehors,
                     base + (cfg.dbDehorsOuvert - base) * part, TAU_GAIN);
      }
    },

    taire() {
      banque.viser('rideau', -60, RIDEAU_T_EXTINCTION);
      partAvant = null;
      vitesseLissee = 0;
    },
  };
}
