// Le rendu de la bande.
//
// Bande 16:9 centree sur fond sombre, sur telephone comme sur ordinateur.
// La source fait 1280x720 et rien ne peut etre rendu a nouveau ; recadrer en
// portrait couterait 68 % de la largeur et detruirait les compositions --
// dont celle du bassin, ou le quadrilatere de l'eau est releve en pixels de la
// plaque et sortirait du cadre. La bande se lit comme un film et libere la
// place du texte hors de l'image.

const RATIO = 16 / 9;

export function creerRendu(canvas, { largeurSource = 1280 } = {}) {
  // Le plafond est la largeur du jeu reellement servi, pas 1280 : avec le jeu
  // mobile, peindre un canvas de 1280 reviendrait a agrandir une image de 854
  // puis a payer le remplissage de pixels qu'elle ne contient pas.
  const LARGEUR_SOURCE = largeurSource;
  const HAUTEUR_SOURCE = Math.round(largeurSource / RATIO);
  const ctx = canvas.getContext('2d', { alpha: false });
  let luminosite = 1;

  /**
   * Dimensionne le canvas au conteneur.
   *
   * On plafonne a 2 le rapport de pixels : au-dela, on peint plus de pixels que
   * la source n'en contient, ce qui coute des trames sans rien ajouter a
   * l'image. La source est le plafond, pas l'ecran.
   */
  function redimensionner() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // Si la mise en page n'est pas encore faite, clientWidth vaut 0 et le canvas
    // se retrouverait a zero pixel, ou drawImage echoue en silence.
    const l = canvas.clientWidth || LARGEUR_SOURCE;
    const h = Math.round((l * HAUTEUR_SOURCE) / LARGEUR_SOURCE);
    const pl = Math.min(Math.round(l * dpr), LARGEUR_SOURCE);
    const ph = Math.round((pl * HAUTEUR_SOURCE) / LARGEUR_SOURCE);
    if (canvas.width !== pl || canvas.height !== ph) {
      canvas.width = pl;
      canvas.height = ph;
    }
    return h;
  }

  /**
   * La transition (D2) est une multiplication par un noir : resultat =
   * image x luminosite. Les ombres meurent donc en premier et les bords
   * eclaires en dernier, ce qui est exactement ce que decrit le document de
   * sequence. Aucun shader, aucun mode de fusion, aucun voile clair : une
   * propriete CSS composee par le GPU, qui ne coute pas une trame.
   */
  function reglerLuminosite(v) {
    if (v === luminosite) return;
    luminosite = v;
    canvas.style.filter = v >= 1 ? 'none' : `brightness(${v.toFixed(3)})`;
  }

  function peindre(bitmap) {
    if (!bitmap) return false;
    ctx.globalAlpha = 1;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return true;
  }

  /**
   * Fondu ENCHAINE entre deux clips : le sortant dessous, l'entrant par-dessus
   * a une opacite croissante.
   *
   * C'est ce qui noie le saut aux jonctions. Chercher une meilleure image de
   * raccord ne marche pas : sur la pire jonction de Parkside, une recherche
   * exhaustive 32 x 40 n'a gagne que 1 %. Les deux clips different reellement
   * -- parallaxe, position de camera -- et aucun choix d'image ne le supprime.
   * Seul un fondu le noie.
   *
   * Il remplace la baisse de luminosite aux jonctions ordinaires : une baisse
   * assombrit sans cacher la coupe, on voyait l'image changer a mi-noir. Le
   * spa garde son extinction, lui, parce que c'est un evenement et non un
   * raccord.
   */
  function peindreFondu(sortant, entrant, part) {
    if (!entrant) return peindre(sortant);
    if (!sortant) return peindre(entrant);
    ctx.globalAlpha = 1;
    ctx.drawImage(sortant, 0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = Math.min(Math.max(part, 0), 1);
    ctx.drawImage(entrant, 0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
    return true;
  }

  return { redimensionner, peindre, peindreFondu, reglerLuminosite };
}
