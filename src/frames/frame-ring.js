// L'anneau glissant d'images decodees.
//
// C'est la piece qui decide de la tenue du projet. Une image 1280x720 decodee
// occupe 3,5 Mio : retenir les 181 images d'une sequence en ferait 637, et un
// onglet mobile meurt bien avant. On n'en garde donc qu'une fenetre autour de
// l'index courant, et tout le reste reste sous forme d'octets compresses.
//
// Le decodage passe par createImageBitmap, qui travaille hors du fil principal :
// la promesse revient sur le fil principal mais le decodage lui-meme ne le
// bloque pas. C'est ce qui permet de decoder en avance pendant que le visiteur
// fait defiler sans provoquer de saccade.

export function creerAnneau(source, { taille, pasImage: pasInitial = 1, nbImages }) {
  let tailleCourante = taille;
  let pasImage = pasInitial;
  const decodees = new Map();   // index -> ImageBitmap
  const enCours = new Set();    // index en cours de decodage
  let centre = 1;               // index courant, reference de l'eviction
  let ecartDernier = 0;         // distance entre l'image voulue et celle rendue

  /** Ramene un index quelconque sur la grille du mode courant. */
  const surGrille = (i) => {
    const j = Math.round(i / pasImage) * pasImage;
    return Math.min(Math.max(j, 1), nbImages);
  };

  async function assurer(i) {
    i = surGrille(i);
    if (decodees.has(i) || enCours.has(i)) return;
    enCours.add(i);
    try {
      const buf = await source.charger(i);
      // Reverification : entre le fetch et ici, l'image a pu etre decodee par
      // un autre appel, ou evincee puis redemandee.
      if (decodees.has(i)) return;
      const bmp = await createImageBitmap(new Blob([buf]));
      decodees.set(i, bmp);
      evincer(i);
    } catch (e) {
      // Une image manquante ne doit jamais casser la page : on garde l'image
      // precedente a l'ecran. Le brief interdit l'ecran vide.
      console.warn(e.message);
    } finally {
      enCours.delete(i);
    }
  }

  /**
   * Eviction par DISTANCE a l'index courant, jamais par ordre d'insertion.
   *
   * Le premier entre, premier sorti n'est correct que sur un parcours
   * strictement monotone. Au premier aller-retour il evince les images les plus
   * anciennement inserees -- c'est-a-dire le centre et ses voisines immediates,
   * exactement celles qu'on affiche. L'anneau se detruisait alors lui-meme a
   * chaque trame, et c'est ce qui produisait le gel.
   *
   * On jette donc toujours la plus eloignee du centre, en protegeant l'image
   * qu'on vient d'ajouter.
   */
  function evincer(proteger) {
    while (decodees.size > tailleCourante) {
      let pire = null, pireD = -1;
      for (const k of decodees.keys()) {
        if (k === proteger) continue;
        const d = Math.abs(k - centre);
        if (d > pireD) { pireD = d; pire = k; }
      }
      if (pire === null) break;
      decodees.get(pire)?.close();
      decodees.delete(pire);
    }
  }

  /**
   * Prend l'image la plus proche disponible, A N'IMPORTE QUELLE DISTANCE.
   *
   * C'est la correction du gel. La recherche etait bornee a douze pas : au-dela
   * elle rendait null, le rendu gardait la derniere image peinte, et l'ecran se
   * figeait pendant que le defilement continuait. Revenir en arriere ramenait a
   * moins de douze images d'une image decodee, ce qui « debloquait » -- le
   * symptome exact.
   *
   * Or le deficit est structurel et aucun tampon ne le comble : trois crans de
   * molette demandent 75 a 150 images par seconde, un decodage WebP en produit
   * 30 a 60. La page ne peut donc pas suivre un defilement rapide, et ce n'est
   * pas ce qu'on lui demande -- on lui demande de DEGRADER au lieu de geler.
   *
   * En rendant toujours la plus proche disponible, un defilement rapide montre
   * un echantillonnage plus grossier de la sequence : le mouvement reste
   * continu, il perd seulement en finesse. Le visiteur ralentit, la finesse
   * revient. C'est le comportement d'une video qui saute des images, pas celui
   * d'une page cassee.
   */
  function image(i) {
    const exact = surGrille(i);
    const trouve = decodees.get(exact);
    if (trouve) { ecartDernier = 0; return trouve; }
    let meilleur = null, meilleureD = Infinity;
    for (const k of decodees.keys()) {
      const d = Math.abs(k - exact);
      if (d < meilleureD) { meilleureD = d; meilleur = k; }
    }
    if (meilleur === null) return null;
    ecartDernier = meilleureD;
    return decodees.get(meilleur);
  }

  /**
   * Demande le decodage autour de l'index courant, DU PLUS PROCHE AU PLUS
   * LOIN, et par paquets bornes.
   *
   * L'ordre et la borne comptent autant que la fenetre. La version precedente
   * lancait jusqu'a trente-sept requetes par trame, soit plus de deux mille par
   * seconde : un navigateur n'ouvre que six connexions par origine, et l'image
   * dont on a besoin MAINTENANT se retrouvait derriere des centaines de
   * requetes emises pour des positions deja depassees. La file ne se vidait
   * jamais.
   *
   * En partant du centre et en bornant le paquet, ce qu'on affiche est toujours
   * demande en premier, et la file reste courte.
   */
  function pourvoir(i, sens, { devant, derriere, paquet = 4 }) {
    centre = surGrille(i);
    const avant = sens >= 0 ? devant : derriere;
    const arriere = sens >= 0 ? derriere : devant;

    let lances = 0;
    const demander = (idx) => {
      if (lances >= paquet) return;
      const j = surGrille(idx);
      if (decodees.has(j) || enCours.has(j)) return;
      assurer(j);
      lances++;
    };

    demander(centre);
    const portee = Math.max(avant, arriere);
    for (let k = 1; k <= portee && lances < paquet; k++) {
      if (k <= avant) demander(centre + k * pasImage);
      if (k <= arriere) demander(centre - k * pasImage);
    }
  }

  /**
   * Amorce l'anneau dans UN seul sens, par paquets bornes.
   *
   * Sert aux segments voisins, qui doivent etre prets avant qu'on y entre. Un
   * anneau alloue est un anneau VIDE : sans amorcage, le decodage ne commence
   * qu'au franchissement de la frontiere, `image()` ne trouve aucune voisine a
   * moins de douze pas, rend null, et le rendu garde la derniere image
   * affichee. L'ecran se fige alors que le defilement continue.
   *
   * Le paquet est borne parce qu'on appelle cette methode a chaque trame :
   * lancer quarante decodages d'un coup a la frontiere ferait exactement
   * l'a-coup qu'on cherche a eviter.
   *
   * @param {number} depuis image de depart
   * @param {number} sens   +1 vers la fin, -1 vers le debut
   * @param {number} cible  nombre d'images decodees visees
   * @param {number} paquet nombre de decodages lances par appel
   */
  function amorcer(depuis, sens, cible, paquet = 3) {
    if (decodees.size >= cible) return true;
    // L'anneau d'un voisin n'a pas encore de centre : son point d'entree en
    // tient lieu, sinon l'eviction jetterait justement ce qu'on amorce.
    centre = surGrille(depuis);
    let lances = 0;
    for (let k = 0; k < cible && lances < paquet; k++) {
      const i = surGrille(depuis + sens * k * pasImage);
      if (decodees.has(i) || enCours.has(i)) continue;
      assurer(i);
      lances++;
    }
    return decodees.size >= cible;
  }

  return {
    assurer,
    pourvoir,
    amorcer,
    image,
    /**
     * Change la taille et le pas SANS jeter le contenu decode.
     *
     * Appele quand le mode degrade bascule en cours de visite. Detruire les
     * anneaux a cet instant -- ce que faisait le code -- vidait celui qu'on
     * etait en train d'afficher : l'image se figeait net et ne revenait
     * jamais. C'etait la vraie cause du blocage a partir de la salle de velos,
     * ou la charge de decodage double et fait justement basculer le mode.
     *
     * L'eviction fait le reste toute seule, au fil des trames.
     */
    reconfigurer({ taille: t, pasImage: p }) {
      if (t) tailleCourante = t;
      if (p) pasImage = p;
      evincer(centre);
    },
    get pretes() { return decodees.size; },
    /** Distance, en images, entre l'image voulue et celle reellement rendue. */
    get ecartDernier() { return ecartDernier; },
    get octetsCharges() { return source.octetsCharges; },
    detruire() {
      decodees.forEach((b) => b.close());
      decodees.clear(); enCours.clear();
    },
  };
}
