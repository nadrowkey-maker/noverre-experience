// Les nappes : chargement, bouclage, et gain.
//
// Toutes les nappes tournent en boucle en permanence, chacune a sa vitesse
// reelle, du premier au dernier ecran. Le defilement ne pilote JAMAIS une tete
// de lecture, il pilote des gains et des filtres.
//
// C'est la quatrieme regle du document, et la seule erreur a ne jamais
// commettre : piloter un fichier par la position du scroll accelererait
// litteralement le monde quand le visiteur scrolle vite -- le bus passerait en
// une demi-seconde et les pas deviendraient une mitraillette.

import { contexte, bus } from './graph.js';
import { AUDIO_BASE, ROGNAGE_BOUCLE } from '../config/audio.js';

const tampons = new Map();

async function charger(fichier) {
  if (tampons.has(fichier)) return tampons.get(fichier);
  const p = fetch(`${AUDIO_BASE}/${fichier}`)
    .then((r) => {
      if (!r.ok) throw new Error(`${fichier} : ${r.status}`);
      return r.arrayBuffer();
    })
    .then((b) => contexte().decodeAudioData(b));
  tampons.set(fichier, p);
  return p;
}

/**
 * Une nappe qui tourne en permanence.
 *
 * `db` fixe une CIBLE, pas une valeur : les niveaux glissent vers elle avec une
 * constante de temps d'une a deux secondes. C'est ce lissage qui tue l'effet
 * mecanique -- sans lui, chaque cran de molette produirait un micro-saut de
 * niveau, et c'est precisement ce qui sonnerait comme une machine.
 */
export async function creerNappe(fichier, { db = -60, sortie = null } = {}) {
  const c = contexte();
  const tampon = await charger(fichier);

  const gain = c.createGain();
  gain.gain.value = enLineaire(db);
  gain.connect(sortie || bus());

  const src = c.createBufferSource();
  src.buffer = tampon;
  src.loop = true;
  // Points de bouclage explicites (D5) : jamais les bornes du tampon, que le
  // decodage MP3 entoure d'un remplissage variable selon le navigateur.
  src.loopStart = ROGNAGE_BOUCLE;
  src.loopEnd = Math.max(ROGNAGE_BOUCLE * 2, tampon.duration - ROGNAGE_BOUCLE);
  src.connect(gain);
  // Depart a une position quelconque : deux nappes qui demarrent ensemble a
  // chaque chargement feraient entendre leur simultaneite.
  src.start(0, Math.random() * tampon.duration);

  return {
    gain,
    source: src,
    /** Vise un niveau. `tau` en secondes, une a deux par defaut. */
    viser(dbCible, tau = 1.5) {
      gain.gain.setTargetAtTime(enLineaire(dbCible), c.currentTime, tau / 3);
    },
    /**
     * Vise un gain LINEAIRE, sans passer par les decibels.
     *
     * Une seule piste en a besoin, l'eau du toit : son volume suit une vitesse
     * de pointeur, pas un niveau de melange. Convertir en decibels puis revenir
     * n'ajouterait qu'une perte de precision autour de zero, la ou l'eau passe
     * le plus clair de son temps.
     */
    viserLineaire(cible, tau = 0.08) {
      gain.gain.setTargetAtTime(cible, c.currentTime, tau / 3);
    },
    arreter() { try { src.stop(); } catch { /* deja arretee */ } },
  };
}

/**
 * Decibels vers gain lineaire. En dessous de -60 dB on vise zero franc : une
 * exponentielle ne l'atteint jamais et laisserait tourner un residu.
 */
export const enLineaire = (db) => (db <= -60 ? 0 : Math.pow(10, db / 20));
