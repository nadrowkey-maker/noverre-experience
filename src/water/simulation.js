// La simulation d'eau, en champ de hauteur.
//
// Deux cibles en ping-pong, RGBA en flottant, filtrage lineaire, bords
// bloques, sans tampon de profondeur. L'etat tient dans les quatre canaux :
// `r` la hauteur, `g` la vitesse, `ba` la normale que la passe de normale y
// ecrit.
//
// L'ORDRE PAR TRAME NE CHANGE PAS : les gouttes, puis DEUX pas de simulation,
// puis UNE passe de normale. La passe de normale ne se joue qu'une fois, apres
// les pas -- la rejouer a chaque sous-pas ferait payer a la trame lente un
// travail qu'elle n'a pas les moyens de faire.

import {
  SOMMET_PLEIN_CADRE, FRAGMENT_GOUTTE, FRAGMENT_SIMULATION, FRAGMENT_NORMALE,
} from './shaders.js';
import {
  RESOLUTION, PAS, PAS_PAR_CADRE, MAX_SOUS_PAS,
  GOUTTE_RAYON, AMORCE_NOMBRE, AMORCE_FORCE, MAX_GOUTTES_PAR_CADRE,
  AMBIANT_NOMBRE, AMBIANT_FORCE, AMBIANT_RAYON, AMBIANT_PERIODE,
  AMBIANT_MULT_ACTIF, INACTIF,
} from '../config/eau.js';

/** Un generateur a graine : deux visites donnent la meme pluie. */
function aleatoireAGraine(graine) {
  let e = graine >>> 0;
  return () => {
    e = (e + 0x6d2b79f5) >>> 0;
    let t = Math.imul(e ^ (e >>> 15), 1 | e);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function compiler(gl, type, source) {
  const s = gl.createShader(type);
  gl.shaderSource(s, source);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error('shader : ' + gl.getShaderInfoLog(s));
  }
  return s;
}

export function programme(gl, sommet, fragment) {
  const p = gl.createProgram();
  gl.attachShader(p, compiler(gl, gl.VERTEX_SHADER, sommet));
  gl.attachShader(p, compiler(gl, gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error('programme : ' + gl.getProgramInfoLog(p));
  }
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const nom = gl.getActiveUniform(p, i).name.replace('[0]', '');
    u[nom] = gl.getUniformLocation(p, nom);
  }
  return { p, u };
}

/** Le quad plein cadre, partage par toutes les passes. */
export function creerQuad(gl) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const pos = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, pos);
  gl.bufferData(gl.ARRAY_BUFFER,
    new Float32Array([-1,-1,0, 1,-1,0, -1,1,0, 1,1,0]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  const uv = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, uv);
  gl.bufferData(gl.ARRAY_BUFFER,
    new Float32Array([0,0, 1,0, 0,1, 1,1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  return vao;
}

/** L'identite, pour les passes plein cadre. */
const IDENTITE = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);

/**
 * Les deux extensions dont l'etat en flottant depend, et ce qu'on fait sans.
 *
 * ELLES N'ETAIENT NI VERIFIEES NI RATTRAPEES, et c'est un defaut qui ne se voit
 * pas depuis un poste de developpement : ici les deux sont la, toujours.
 *
 *   EXT_color_buffer_float     sans elle on ne peut pas RENDRE dans une texture
 *                              flottante. Elle etait bien testee.
 *
 *   OES_texture_float_linear   sans elle on ne peut pas FILTRER une texture
 *                              flottante en lineaire. Elle etait demandee et sa
 *                              reponse jetee -- or une texture flottante posee
 *                              en LINEAR sur un appareil qui ne sait pas la
 *                              filtrer est une texture INCOMPLETE : chaque
 *                              lecture rend (0,0,0,1), sans erreur, sans
 *                              message, sans rien dans la console. La
 *                              simulation tourne, la surface reste plate, et
 *                              l'eau ne bouge pas. Exactement le defaut
 *                              silencieux qu'on ne peut pas diagnostiquer a
 *                              distance.
 *
 * Le repli est le filtrage AU PLUS PROCHE. Il ne coute presque rien ici : la
 * passe de simulation ne lit que des voisins alignes sur le texel, ou lineaire
 * et au plus proche donnent le meme resultat. Seule la lecture de la normale
 * par la surface y perd, et elle y perd peu -- 256 x 256 etale sur la zone du
 * bassin, sous une refraction de 0,07. Une eau legerement moins douce vaut
 * mieux qu'une eau immobile.
 */
export function creerSimulation(gl) {
  if (!gl.getExtension('EXT_color_buffer_float')) {
    throw new Error('EXT_color_buffer_float indisponible');
  }
  const filtrable = !!gl.getExtension('OES_texture_float_linear');
  const FILTRE = filtrable ? gl.LINEAR : gl.NEAREST;

  const vao = creerQuad(gl);
  const prog = {
    goutte: programme(gl, SOMMET_PLEIN_CADRE, FRAGMENT_GOUTTE),
    simulation: programme(gl, SOMMET_PLEIN_CADRE, FRAGMENT_SIMULATION),
    normale: programme(gl, SOMMET_PLEIN_CADRE, FRAGMENT_NORMALE),
  };
  for (const { p, u } of Object.values(prog)) {
    gl.useProgram(p);
    if (u.projectionMatrix) gl.uniformMatrix4fv(u.projectionMatrix, false, IDENTITE);
    if (u.modelViewMatrix) gl.uniformMatrix4fv(u.modelViewMatrix, false, IDENTITE);
    if (u.uTexel) gl.uniform2f(u.uTexel, 1 / RESOLUTION, 1 / RESOLUTION);
  }

  /** Une cible : texture flottante, lineaire, bords bloques, sans profondeur. */
  const cible = () => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, RESOLUTION, RESOLUTION, 0,
                  gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, FILTRE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, FILTRE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    // ON DEMANDE SON AVIS AU PILOTE. Un attachement flottant refuse rend un
    // framebuffer INCOMPLET, et tout ce qui suit devient un dessin dans le
    // vide : aucune erreur ne remonte, la surface reste plate. C'est le meme
    // defaut muet que le filtrage, et il se ferme de la meme facon -- en
    // posant la question, une fois, a la creation.
    const etat = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (etat !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(`cible flottante refusee (0x${etat.toString(16)})`);
    }
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return { t, f };
  };
  const etats = [cible(), cible()];
  let lecture = 0;

  /** Rend `prog` de l'etat courant vers l'autre, puis echange. */
  function passe({ p, u }) {
    gl.useProgram(p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, etats[lecture ^ 1].f);
    gl.viewport(0, 0, RESOLUTION, RESOLUTION);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, etats[lecture].t);
    gl.uniform1i(u.uEtat, 0);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    lecture ^= 1;
  }

  function goutte(x, z, force, rayon) {
    const { u } = prog.goutte;
    gl.useProgram(prog.goutte.p);
    gl.uniform2f(u.uCentre, x, z);
    gl.uniform1f(u.uForce, force);
    gl.uniform1f(u.uRayon, rayon);
    passe(prog.goutte);
  }

  // --- la file de gouttes ---------------------------------------------------
  // Bornee : chaque goutte est une passe complete, et une file qui grossirait
  // plus vite qu'on ne la vide ferait payer a la trame suivante un retard
  // qu'elle ne rattraperait jamais. Au-dela, la goutte est perdue -- c'est la
  // bonne perte.
  const FILE_MAX = MAX_GOUTTES_PAR_CADRE * 4;
  let enAttente = [];
  const enfiler = (x, z, force, rayon) => {
    if (enAttente.length >= FILE_MAX) return;
    enAttente.push({ x, z, force, rayon });
  };

  const tirer = aleatoireAGraine(0x0a5104);
  const sources = Array.from({ length: AMBIANT_NOMBRE }, () => ({
    x: -0.6 + 1.2 * tirer(),
    z: -0.6 + 1.2 * tirer(),
    amplitude: 0.1 + 0.15 * tirer(),
    vitesse: 0.05 + 0.09 * tirer(),
    phase: tirer() * Math.PI * 2,
    prochaine: tirer() * AMBIANT_PERIODE,
  }));

  let temps = 0;
  let derniereInteraction = -1e9;
  let accumulateur = 0;
  let amorce = false;

  /**
   * Les gouttes ambiantes : ce qui garde l'eau VIVANTE quand personne ne la
   * touche. Sans elles la surface se fige des qu'on lache la souris, alors que
   * le document exige l'inverse -- « elle continue de bouger quand le
   * defilement s'est arrete ».
   */
  function collecterAmbiantes(pas) {
    const inactif = temps - derniereInteraction > INACTIF;
    const force = AMBIANT_FORCE * (inactif ? 1 : AMBIANT_MULT_ACTIF);
    for (const s of sources) {
      s.prochaine -= pas;
      if (s.prochaine > 0) continue;
      s.prochaine = AMBIANT_PERIODE * (0.7 + tirer() * 0.6);
      const d = s.amplitude;
      const x = s.x + d * Math.sin(temps * s.vitesse + s.phase);
      const z = s.z + d * Math.cos(temps * s.vitesse * 1.3 + s.phase);
      enfiler(Math.min(Math.max(x, -0.92), 0.92),
              Math.min(Math.max(z, -0.92), 0.92), force, AMBIANT_RAYON);
    }
  }

  function amorcer() {
    if (amorce) return;
    amorce = true;
    for (let i = 0; i < AMORCE_NOMBRE; i++) {
      goutte(tirer() * 2 - 1, tirer() * 2 - 1,
             i & 1 ? AMORCE_FORCE : -AMORCE_FORCE, GOUTTE_RAYON);
    }
  }

  /** Un pas de physique : les gouttes en attente, puis les deux pas. */
  function pasPhysique() {
    const n = Math.min(enAttente.length, MAX_GOUTTES_PAR_CADRE);
    for (let i = 0; i < n; i++) {
      const g = enAttente[i];
      goutte(g.x, g.z, g.force, g.rayon);
    }
    if (n > 0) enAttente = enAttente.slice(n);
    for (let i = 0; i < PAS_PAR_CADRE; i++) passe(prog.simulation);
  }

  return {
    enfiler,
    marquerInteraction() { derniereInteraction = temps; },
    get texture() { return etats[lecture].t; },
    /** Ce que l'appareil sait faire, pour que le temoin puisse le dire. */
    filtrage: filtrable ? 'lineaire' : 'au plus proche',

    /**
     * Avance d'une trame. Pas de temps FIXE : la simulation ne depend pas de la
     * cadence, et une trame lente est rattrapee en trois sous-pas au plus --
     * au-dela on laisse filer plutot que d'entrer dans la spirale ou le
     * rattrapage coute plus que le retard.
     */
    avancer(dt) {
      amorcer();
      temps += dt;
      let s = Math.min(dt, 0.25);
      accumulateur += s;
      let n = 0;
      while (accumulateur >= PAS && n < MAX_SOUS_PAS) {
        collecterAmbiantes(PAS);
        pasPhysique();
        accumulateur -= PAS;
        n++;
      }
      if (n === 0) return;
      passe(prog.normale);
    },

    /** Mouvement reduit : une eau posee, calculee une fois, puis immobile. */
    poser() {
      amorcer();
      for (let i = 0; i < 60; i++) pasPhysique();
      passe(prog.normale);
    },
  };
}
