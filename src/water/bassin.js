// Le bassin de la piscine : la simulation posee sur la photographie.
//
// Un canvas WebGL vient par-dessus celui du parcours, et ne vit que sur la
// derniere sequence. Il dessine la plaque lui-meme -- l'image de la trame
// courante -- et deforme la seule zone du bassin par la normale de la
// simulation. Partout ailleurs il recopie la plaque a l'identique.
//
// Ce qui n'est PAS simule, et pourquoi : le fond du bassin, les parois, les
// caustiques, la couleur de l'eau a chaque heure. Tout cela est deja dans
// l'image et deja juste. Les simuler les doublerait, et les doublerait moins
// bien.
//
// LA PLAQUE SOURCE EST IMMOBILE, et c'est indispensable : le clip a ete tourne
// avec une surface parfaitement plane. Si elle ondulait deja dans l'image, on
// aurait deux eaux qui bougent differemment et le truquage se verrait
// immediatement. Il n'y a donc aucun mouvement a corriger dans la plaque.

import { FRAGMENT_SURFACE, SOMMET_PLEIN_CADRE } from './shaders.js';
import { creerSimulation, programme, creerQuad } from './simulation.js';
import { versUniteN } from './homographie.js';
import { BASSIN_REPERES, BASSIN_OCCULTANTS, occultantsA } from '../config/bassin.js';
import {
  VITESSE_PLEINE, LISSAGE_VITESSE, GOUTTE_BASE, GOUTTE_AMPLITUDE, GOUTTE_RAYON,
  CLIC_FORCE, CLIC_RAYON, REFRACTION,
  MIROITEMENT, ECLAT_SOLEIL, ECLAT_NUIT, TEINTE_SOLEIL, TEINTE_NUIT,
  GAIN_SOLEIL, GAIN_NUIT, DURETE, AMPLI_PENTE, OBLIQUITE, OEIL_UV, ETALEMENT,
} from '../config/eau.js';

const LARGEUR = 1280, HAUTEUR = 720;
const IDENTITE = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);

/**
 * Lit une table de points (t, ...) a la position t, en interpolant.
 *
 * Les tables sont echantillonnees a pas irregulier -- serre la ou la lumiere
 * bouge vite, lache la ou plus rien ne change -- donc on cherche l'intervalle
 * plutot que de calculer un indice.
 */
function lire(table, t) {
  if (t <= table[0][0]) return table[0].slice(1);
  for (let i = 1; i < table.length; i++) {
    if (t <= table[i][0]) {
      const a = table[i - 1], b = table[i];
      const k = (t - a[0]) / (b[0] - a[0]);
      return a.slice(1).map((v, j) => v + (b[j + 1] - v) * k);
    }
  }
  return table[table.length - 1].slice(1);
}

export function creerBassin(canvas) {
  const gl = canvas.getContext('webgl2', {
    alpha: false, antialias: false, depth: false, powerPreference: 'high-performance',
  });
  if (!gl) return null;

  // On ne mange PAS l'erreur : un bassin qui echoue en silence est un bassin
  // qu'on ne saura jamais reparer. L'appelant decide s'il degrade ou non.
  const sim = creerSimulation(gl);

  const surface = programme(gl, SOMMET_PLEIN_CADRE, FRAGMENT_SURFACE);
  const vao = creerQuad(gl);
  gl.useProgram(surface.p);
  gl.uniformMatrix4fv(surface.u.projectionMatrix, false, IDENTITE);
  gl.uniformMatrix4fv(surface.u.modelViewMatrix, false, IDENTITE);

  /** La plaque : l'image de la trame courante, televersee telle quelle. */
  const texPlaque = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texPlaque);
  for (const p of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR],
                   [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) {
    gl.texParameteri(gl.TEXTURE_2D, p[0], p[1]);
  }

  /**
   * Le masque des occultants, rasterise sur un canvas 2D puis televerse.
   *
   * SUR CE PLAN IL EST VIDE : rien ne traverse la ligne d'eau -- pas d'echelle,
   * pas de barre, pas de mobilier qui plonge. Les bains de soleil et la
   * margelle sont entierement hors du quadrilatere, et l'eau n'est jamais
   * dessinee hors du quadrilatere : ils n'ont donc besoin d'aucun masque.
   *
   * On garde le mecanisme, mais on ne le fait TOURNER QU'UNE FOIS quand la
   * liste est vide -- le masque est alors constant, et le refaire a chaque
   * trame serait un televersement de texture payé pour rien. Des qu'un
   * occultant est releve, la mise a jour par trame reprend d'elle-meme, parce
   * que les silhouettes derivent avec la camera.
   */
  const mCanvas = document.createElement('canvas');
  mCanvas.width = LARGEUR / 2; mCanvas.height = HAUTEUR / 2;
  const mCtx = mCanvas.getContext('2d', { alpha: false });
  const texMasque = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texMasque);
  for (const p of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR],
                   [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) {
    gl.texParameteri(gl.TEXTURE_2D, p[0], p[1]);
  }

  const masqueConstant = BASSIN_OCCULTANTS.length === 0;
  let masqueT = -1;
  function majMasque(t) {
    if (masqueConstant && masqueT >= 0) return;
    if (Math.abs(t - masqueT) < 0.004) return;   // ~1 image sur la sequence
    masqueT = t;
    mCtx.fillStyle = '#000';
    mCtx.fillRect(0, 0, mCanvas.width, mCanvas.height);
    mCtx.fillStyle = '#fff';
    for (const contour of occultantsA(t)) {
      mCtx.beginPath();
      mCtx.moveTo(contour[0][0] / 2, contour[0][1] / 2);
      for (const p of contour.slice(1)) mCtx.lineTo(p[0] / 2, p[1] / 2);
      mCtx.closePath(); mCtx.fill();
    }
    gl.bindTexture(gl.TEXTURE_2D, texMasque);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mCanvas);
  }

  // --- le pointeur ----------------------------------------------------------
  let pointeur = null, precX = 0, precY = 0, aPointeur = false;
  let vitesse = 0, clics = 0, clicsVus = 0;

  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    pointeur = [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height,
                e.clientX, e.clientY];
  }, { passive: true });
  canvas.addEventListener('pointerleave', () => { pointeur = null; }, { passive: true });
  canvas.addEventListener('pointerdown', () => { clics++; }, { passive: true });

  let versU = null;

  return {
    /**
     * @param {ImageBitmap} plaque l'image de la trame
     * @param {number} u           INDEX D'IMAGE NORMALISE, 0 a 1 -- et non la
     *                             progression du defilement. Les reperes de
     *                             calage sont poses sur des index d'image,
     *                             alors que la progression suit une loi en
     *                             carre au debut d'un segment qui porte une
     *                             `miseEnRoute`. L'appelant fait la conversion.
     * @param {number} dt          duree de la trame, en secondes
     * @param {Function} surVitesse remonte la vitesse lissee du pointeur, ou null
     * @param {object}  [options]
     * @param {number}  [options.force=1]  montee de la houle, 0 rend la plaque intacte
     * @param {boolean} [options.fausses]  fausses couleurs de recette, jamais en production
     */
    trame(plaque, u, dt, surVitesse, { force = 1, fausses = false } = {}) {
      if (canvas.width !== LARGEUR) { canvas.width = LARGEUR; canvas.height = HAUTEUR; }

      // L'homographie a N reperes : on interpole les QUATRE POINTS entre les
      // reperes, jamais la matrice. Ce plan zoome en arriere d'environ six pour
      // cent, et un jeu de coins fige decollerait franchement en fin de plan.
      versU = versUniteN(BASSIN_REPERES, u, LARGEUR, HAUTEUR);

      // -- le pointeur, la vitesse, l'onde et le son -------------------------
      // La vitesse est mesuree en pixels d'ecran et lissee. C'est cette valeur,
      // et elle seule, qui creuse l'onde ET qui ouvre le gain de l'eau : ce
      // qu'on entend est exactement ce qu'on voit.
      let dansBassin = false;
      if (pointeur) {
        const [ux, uy] = appliquer(versU, pointeur[0], pointeur[1]);
        dansBassin = ux > 0 && ux < 1 && uy > 0 && uy < 1;
        if (dansBassin) {
          if (aPointeur) {
            const brute = Math.hypot(pointeur[2] - precX, pointeur[3] - precY);
            vitesse += (brute - vitesse) * LISSAGE_VITESSE;
          } else {
            // Premiere trame sous le pointeur : aucun deplacement a mesurer, et
            // surtout aucun saut a injecter depuis une position qui date d'un
            // autre endroit de l'ecran.
            vitesse = 0;
          }
          const x = ux * 2 - 1, z = uy * 2 - 1;
          if (clics !== clicsVus) {
            clicsVus = clics;
            sim.enfiler(x, z, CLIC_FORCE, CLIC_RAYON);
          } else if (aPointeur) {
            const part = Math.min(vitesse / VITESSE_PLEINE, 1);
            sim.enfiler(x, z, GOUTTE_BASE + part * GOUTTE_AMPLITUDE, GOUTTE_RAYON);
          }
          precX = pointeur[2]; precY = pointeur[3];
          aPointeur = true;
          sim.marquerInteraction();
          surVitesse(vitesse);
        }
      }
      if (!dansBassin) { vitesse = 0; aPointeur = false; surVitesse(null); }

      sim.avancer(dt);
      majMasque(u);

      // -- le rendu ----------------------------------------------------------
      gl.bindTexture(gl.TEXTURE_2D, texPlaque);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, plaque);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, LARGEUR, HAUTEUR);
      gl.useProgram(surface.p);

      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texPlaque);
      gl.uniform1i(surface.u.uPlaque, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, sim.texture);
      gl.uniform1i(surface.u.uEtat, 1);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, texMasque);
      gl.uniform1i(surface.u.uMasque, 2);

      gl.uniformMatrix3fv(surface.u.uVersUnite, false, new Float32Array(versU));
      gl.uniform1f(surface.u.uRefraction, REFRACTION * force);

      // Le chemin du soleil. Inerte sur ce plan : ECLAT_SOLEIL y vaut zero
      // partout, faute de trainee chaude dans l'eau (voir config/eau.js). Les
      // uniformes restent poses pour qu'un plan avec soleil visible n'ait
      // qu'une table a remplir.
      const [mu, mv, eu, ev] = lire(MIROITEMENT, u);
      gl.uniform2f(surface.u.uMiroir, mu, mv);
      gl.uniform2f(surface.u.uEtendue, eu * ETALEMENT, ev * ETALEMENT);

      // L'azimut : de l'oeil vers le miroitement, donc vers le soleil. C'est
      // lui qui decide quelles facettes s'allument.
      const ax = mu - OEIL_UV[0], av = mv - OEIL_UV[1];
      const n = Math.hypot(ax, av) || 1;
      gl.uniform2f(surface.u.uPencher, (ax / n) * OBLIQUITE, (av / n) * OBLIQUITE);

      // Les deux termes. Le soleil meurt, les projecteurs prennent la suite --
      // ici le premier est deja mort, et c'est le second qui empeche l'eau de
      // nuit d'avoir l'air morte. Une eau simplement assombrie est une eau
      // morte : elle ne perd pas son eclat la nuit, elle en change.
      const soleil = lire(ECLAT_SOLEIL, u)[0] * GAIN_SOLEIL * force;
      const nuit = lire(ECLAT_NUIT, u)[0] * GAIN_NUIT * force;
      gl.uniform3f(surface.u.uSoleil, TEINTE_SOLEIL[0] * soleil,
                   TEINTE_SOLEIL[1] * soleil, TEINTE_SOLEIL[2] * soleil);
      gl.uniform3f(surface.u.uNuit, TEINTE_NUIT[0] * nuit,
                   TEINTE_NUIT[1] * nuit, TEINTE_NUIT[2] * nuit);
      gl.uniform1f(surface.u.uDurete, DURETE);
      gl.uniform1f(surface.u.uAmpli, AMPLI_PENTE);
      gl.uniform1f(surface.u.uFausses, fausses ? 1 : 0);

      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },

    /** Mouvement reduit : une eau detaillee et immobile, calculee une fois. */
    poser(plaque, u) {
      sim.poser();
      this.trame(plaque, u, 0, () => {});
    },
  };
}

/** Applique une homographie donnee en colonnes a un point. */
function appliquer(m, x, y) {
  const w = m[2] * x + m[5] * y + m[8];
  return [(m[0] * x + m[3] * y + m[6]) / w, (m[1] * x + m[4] * y + m[7]) / w];
}
