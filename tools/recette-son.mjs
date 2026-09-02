// Banc de la couche sonore : on ouvre le vrai site, on entre AVEC LE SON, et
// l'on mesure ce qui sort du bus principal.
//
//   python tools/serve.py &
//   node tools/recette-son.mjs
//
// Il ne juge pas a l'oreille -- il ne peut pas -- mais il attrape tout ce qui
// se diagnostique tres mal a l'oreille, et c'est precisement la que sont les
// defauts couteux :
//
//   piege 16   une piste qui part a pleine puissance parce que son gain a ete
//              pose en dur au lieu d'etre vise depuis -60.
//   piege 17   une piste que rien ne peut plus fermer.
//   piege §6.7 deux traversees qui partagent une piste : la seconde recupere
//              la piste deja branchee sur le filtre de la premiere, et sa
//              fenetre ne s'entend pas se fermer. Invisible a l'oreille.
//
// LA MESURE. On branche un analyseur sur la destination et l'on releve le
// niveau RMS et le spectre. C'est ce qui permet de dire « il y a du son », « il
// n'y en a plus », et surtout « les aigus sont tombes mais pas les graves » --
// la signature exacte d'une vitre qui se referme.

import { mkdirSync, writeFileSync } from 'node:fs';
import { ouvrirNavigateur, dormir } from './pilote.mjs';

const BASE = process.env.BASE || 'http://localhost:8000';
const SORTIE = process.env.SORTIE || './build/recette-son';

let echecs = 0;
const ok = (c, quoi, detail = '') => {
  if (!c) echecs++;
  console.log(`  ${c ? 'ok  ' : 'ECHEC'} ${quoi}${detail ? '   ' + detail : ''}`);
};

/**
 * Pose un analyseur sur la destination du contexte audio.
 *
 * On ne peut pas atteindre le contexte depuis l'exterieur : `graph.js` le garde
 * pour lui. On intercepte donc `AudioContext` A LA CONSTRUCTION, avant que le
 * module ne tourne, et l'on insere l'analyseur entre le bus et la sortie.
 */
const SONDE = `
  (() => {
    const Vrai = window.AudioContext || window.webkitAudioContext;
    window.__son = { contexte: null, analyseur: null };
    class Sonde extends Vrai {
      constructor(...a) {
        super(...a);
        const an = this.createAnalyser();
        an.fftSize = 2048;
        an.smoothingTimeConstant = 0.3;
        an.connect(this.destination);
        window.__son.contexte = this;
        window.__son.analyseur = an;
        // Tout ce qui vise la destination passe desormais par l'analyseur.
        const vraie = this.destination;
        Object.defineProperty(this, 'destination', { get: () => an });
        window.__son.destinationVraie = vraie;
      }
    }
    window.AudioContext = Sonde;
    window.webkitAudioContext = Sonde;
  })();
`;

/** Niveau RMS et repartition grave/aigu, moyennes sur quelques trames. */
const MESURER = (ms = 400) => `
  (async () => {
    const s = window.__son;
    if (!s.analyseur) return { erreur: 'aucun contexte audio' };
    const an = s.analyseur;
    const temps = new Float32Array(an.fftSize);
    const freq = new Float32Array(an.frequencyBinCount);
    let rms = 0, n = 0;
    const bas = [], haut = [];
    const t0 = performance.now();
    while (performance.now() - t0 < ${ms}) {
      an.getFloatTimeDomainData(temps);
      let s2 = 0;
      for (let i = 0; i < temps.length; i++) s2 += temps[i] * temps[i];
      rms += Math.sqrt(s2 / temps.length); n++;
      an.getFloatFrequencyData(freq);
      // Le contexte tourne a 48 kHz ; chaque bin vaut donc environ 23 Hz.
      const parBin = s.contexte.sampleRate / an.fftSize;
      let b = 0, h = 0, nb = 0, nh = 0;
      for (let i = 1; i < freq.length; i++) {
        const f = i * parBin;
        const v = Math.pow(10, freq[i] / 20);
        if (f < 200) { b += v; nb++; }
        else if (f > 2000 && f < 9000) { h += v; nh++; }
      }
      bas.push(nb ? b / nb : 0); haut.push(nh ? h / nh : 0);
      await new Promise(r => setTimeout(r, 25));
    }
    const moy = (a) => a.reduce((x, y) => x + y, 0) / Math.max(a.length, 1);
    return {
      rms: rms / Math.max(n, 1),
      db: 20 * Math.log10(Math.max(rms / Math.max(n, 1), 1e-10)),
      bas: moy(bas), haut: moy(haut),
      etat: s.contexte.state,
    };
  })()`;

const POUSSER = (n, delta) => `
  (async () => {
    for (let k = 0; k < ${n}; k++) {
      window.dispatchEvent(new WheelEvent('wheel', { deltaY: ${delta}, bubbles: true, cancelable: true }));
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    }
    await new Promise(r => setTimeout(r, 150));
    return true;
  })()`;

/** Remet le parcours au depart. `Home` saute et remet les vitesses a zero. */
const AU_DEPART = `(async () => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
  await new Promise(r => setTimeout(r, 500));
  return true;
})()`;

const SEGMENT = `((document.getElementById('temoin').textContent.split('—').pop()) || '').trim()`;

const nav = await ouvrirNavigateur({ largeur: 1280, hauteur: 720 });
mkdirSync(SORTIE, { recursive: true });

try {
  console.log(`\nbanc du son — ${BASE}\n`);
  await nav.avantChaqueDocument(SONDE);
  await nav.aller(`${BASE}/`);
  await dormir(2500);

  // --- 1. Aucun son sans clic ------------------------------------------------
  console.log('1. aucun son ne demarre sans clic explicite');
  {
    const avant = await nav.evaluer('!!window.__son.contexte');
    ok(!avant, 'aucun contexte audio n\'existe avant le clic',
       avant ? 'un contexte a ete cree au chargement' : '');
    const porte = await nav.evaluer(
      `document.getElementById('porte').dataset.etat`);
    ok(porte === 'choix', 'la porte attend le choix du visiteur', porte);
  }

  // --- 2. Entrer avec le son -------------------------------------------------
  console.log('\n2. entrer avec le son');
  await nav.evaluer(
    `document.querySelector('[data-son="oui"]').click(), true`);
  await dormir(1200);
  const ouvert = await nav.evaluer(MESURER(600));
  ok(!ouvert.erreur, 'un contexte audio existe apres le clic', ouvert.erreur || '');
  ok(ouvert.etat === 'running', 'le contexte tourne', ouvert.etat);
  ok(ouvert.db > -70, 'il sort du son du bus principal',
     `${ouvert.db.toFixed(1)} dB`);

  // L'amorce doit etre LA, et forte : c'est le son du logo.
  await dormir(2500);
  const amorce = await nav.evaluer(MESURER(600));
  // On verifie qu'elle SONNE, pas qu'elle atteigne un niveau precis. Le morceau
  // a ses propres creux, et comparer a un seuil serre rendait ce controle
  // instable selon l'instant ou la mesure tombe dans les neuf secondes de
  // l'ouverture : il passait ou echouait d'un passage a l'autre sans que rien
  // n'ait change. Un banc instable est pire qu'aucun banc.
  ok(amorce.db > -70, 'l\'amorce joue pendant l\'ouverture',
     `${amorce.db.toFixed(1)} dB`);
  await nav.photo(`${SORTIE}/01-amorce.png`);

  // --- 3. L'amorce finit, le parcours rend la main ---------------------------
  console.log('\n3. la porte rend la main a la fin de l\'amorce');
  await dormir(9000);
  const etatPorte = await nav.evaluer(
    `document.getElementById('porte').dataset.etat`);
  ok(etatPorte === 'fini', 'la porte s\'efface', etatPorte);
  await nav.photo(`${SORTIE}/02-apres-amorce.png`);

  // --- 4. Le parcours, segment par segment -----------------------------------
  // On releve le niveau et la balance grave/aigu a chaque segment. Rien n'y est
  // juge « beau » : on verifie qu'il y a du son la ou il doit y en avoir, et
  // qu'il n'y en a plus la ou il ne doit plus y en avoir.
  console.log('\n4. le niveau segment par segment');
  const releves = [];
  const vus = new Set();
  console.log(`     ${'segment'.padEnd(16)} ${'dB'.padStart(7)} ${'graves'.padStart(9)} ${'aigus'.padStart(9)}`);
  for (let etape = 0; etape < 200; etape++) {
    const seg = await nav.evaluer(SEGMENT);
    if (!vus.has(seg)) {
      vus.add(seg);
      const m = await nav.evaluer(MESURER(350));
      releves.push({ segment: seg, ...m });
      console.log(`     ${seg.padEnd(16)} ${m.db.toFixed(1).padStart(7)} ` +
                  `${m.bas.toExponential(2).padStart(9)} ${m.haut.toExponential(2).padStart(9)}`);
    }
    if (seg === 'faits') break;
    await nav.evaluer(POUSSER(3, 150));
  }

  const parSegment = new Map(releves.map((r) => [r.segment, r]));
  for (const id of ['01-facade', '03-hall', '04-spa', '05-velos', '12-restaurant',
                    '13-piscine']) {
    const r = parSegment.get(id);
    ok(r && r.db > -70, `${id} sonne`, r ? `${r.db.toFixed(1)} dB` : 'jamais atteint');
  }

  // L'ECRAN DES FAITS EST SILENCIEUX. Apres quatre minutes, le silence est la
  // chose la plus forte de la page -- et il n'existe que si le bassin s'est
  // vide avant lui.
  const faits = parSegment.get('faits');
  if (faits) {
    const piscine = parSegment.get('13-piscine');
    ok(faits.db < (piscine ? piscine.db : 0) - 6,
       'l\'ecran des faits est nettement plus silencieux que la piscine',
       `${faits.db.toFixed(1)} dB contre ${piscine ? piscine.db.toFixed(1) : '?'}`);
  }

  // --- 4 ter. LE DEHORS S'ENTEND HORS DES TRAVERSEES -------------------------
  //
  // Controle ne : les quatre pistes du dehors sont routees a travers le
  // scellement de la traversee DES LEUR CREATION, et rien ne peut les
  // debrancher ensuite. Le scellement est donc sur leur chemin du premier au
  // dernier ecran, y compris sur les onze sequences qui n'ont aucune traversee.
  //
  // Laisse ferme, il y mettait un passe-bas a 200 Hz et -46 dB : le lever du
  // jour de la premiere sequence ne donnait plus rien, et la part de jour de la
  // piscine non plus. Seul `parc-nuit`, hors de `dehors`, passait -- ce qui
  // masquait le defaut, puisque la nuit, elle, s'entendait.
  //
  // On mesure donc les AIGUS a la fin du lever du jour et au debut de la
  // piscine : ce sont les deux endroits ou le dehors doit etre le plus present
  // sans qu'aucune fenetre ne soit ouverte.
  console.log('\n4 ter. le dehors s\'entend hors des traversees');
  {
    async function finDeSegment(id, nom) {
      await nav.evaluer(AU_DEPART);
      // Pas LARGE : ce trajet ne mesure rien, il amene le banc au bon endroit.
      // Le pas fin est reserve a ce qu'on observe.
      for (let etape = 0; etape < 200; etape++) {
        if ((await nav.evaluer(SEGMENT)) === id) break;
        await nav.evaluer(POUSSER(6, 250));
      }
      // On avance dans le segment jusqu'a sa derniere moitie, la ou le jour est
      // installe, puis on laisse les gains s'etablir : TAU_GAIN vaut 1,5 s.
      await nav.evaluer(POUSSER(10, 150));
      await dormir(2500);
      const m = await nav.evaluer(MESURER(500));
      console.log(`     ${nom.padEnd(28)} ${m.db.toFixed(1).padStart(7)} dB   ` +
                  `aigus ${m.haut.toExponential(2)}`);
      return m;
    }
    const jour = await finDeSegment('01-facade', 'le jour sur la facade');
    ok(jour.haut > 2e-6, 'la foret s\'entend au lever du jour',
       `aigus ${jour.haut.toExponential(2)}`);
    const piscine = await finDeSegment('13-piscine', 'le jour sur la piscine');
    ok(piscine.haut > 2e-6, 'la foret s\'entend sur la part de jour de la piscine',
       `aigus ${piscine.haut.toExponential(2)}`);
  }

  // --- 4 bis. LES TRAVERSEES DE FACADE ---------------------------------------
  //
  // C'est le controle le plus important de ce banc, parce que c'est le defaut
  // qui se diagnostique le plus mal a l'oreille : on entend bien le dehors en
  // sortant, et il redevient « interieur » deux secondes plus tard sans qu'on
  // sache pourquoi.
  //
  // LE SIGNAL EST LES AIGUS, pas le niveau. Le scellement coupe au-dessus de
  // 200 Hz : dehors il est ouvert et les 2-9 kHz sont la, dedans il est ferme
  // et ils ont disparu. Le niveau global, lui, bouge pour dix autres raisons.
  //
  // La cause du defaut trouve ici : quatre scenes declarent `parc-jour`,
  // `lointain` ou `vent` en couche, et `scenesBasculer` appelle `taire()` sur
  // toutes les scenes qui ne sont pas la courante -- ce qui poussait ces pistes
  // a -60 A CHAQUE FRANCHISSEMENT DE FRONTIERE. Or une excursion enjambe
  // justement une frontiere.
  console.log('\n4 bis. les traversees de facade');
  {
    async function suivreExcursion(depart, arrivee, nom) {
      await nav.evaluer(AU_DEPART);
      const serie = [];
      for (let etape = 0; etape < 400; etape++) {
        const seg = await nav.evaluer(SEGMENT);
        if (seg !== depart && seg !== arrivee && !serie.length) {
          // Pas encore arrive : on avance vite.
          await nav.evaluer(POUSSER(6, 250));
          continue;
        }
        if (seg === depart || seg === arrivee) {
          const m = await nav.evaluer(MESURER(200));
          serie.push({ seg, haut: m.haut, db: m.db });
        }
        if (serie.length && seg !== depart && seg !== arrivee) break;
        await nav.evaluer(POUSSER(2, 150));
      }
      const h = serie.map((e) => e.haut);
      const segs = serie.map((e) => e.seg);
      const moy = (a) => a.reduce((x, y) => x + y, 0) / Math.max(a.length, 1);
      console.log(`     ${nom}`);
      console.log(`       aigus : ${h.map((v) => v.toExponential(1)).join(' ')}`);
      ok(serie.length > 6, `${nom} : l'excursion a ete balayee`, `${serie.length} releves`);

      // LA FRONTIERE, et c'est LE point du test.
      //
      // On ne compare pas au debut du segment de depart : la musique des velos
      // y traine encore et ses aigus ecrasent tout, ce qui rendrait la mesure
      // illisible. On compare de part et d'autre de la FRONTIERE ENTRE LES DEUX
      // SEGMENTS -- on y est dehors des deux cotes, donc les aigus doivent y
      // etre du meme ordre.
      //
      // C'est exactement la que le defaut se produisait : `scenesBasculer`
      // appelle `taire()` a chaque frontiere, ce qui poussait a -60 les pistes
      // du dehors que d'autres scenes declarent en couche.
      // ON COMPARE DEHORS A DEDANS, ET NON DEHORS A DEHORS.
      //
      // Comparer les deux cotes de la frontiere semblait naturel, mais le
      // resultat sautait de 35 % a 350 % d'un passage a l'autre : le pas
      // d'echantillonnage vaut plusieurs centaines de pixels de defilement,
      // donc les relevés tombent au hasard avant ou apres le franchissement,
      // qui est lui a une image pres. La mesure ne mesurait que ce hasard.
      //
      // Le bon repere est l'INTERIEUR : les derniers relevés du segment
      // d'arrivee sont pris apres le retour, donc dedans a coup sur. Si le
      // debut du segment d'arrivee est franchement au-dessus, c'est qu'on y
      // etait encore dehors -- ce qui est exactement la question posee.
      //
      // Le defaut corrige donnait un rapport de 1 : le dehors s'effondrait au
      // niveau interieur des le passage de la frontiere.
      const dansArrivee = serie.filter((e) => e.seg === arrivee).map((e) => e.haut);
      if (dansArrivee.length >= 4) {
        const debut = moy(dansArrivee.slice(0, 2));
        const dedans = moy(dansArrivee.slice(-2));
        ok(debut > dedans * 3,
           `${nom} : on est encore DEHORS au debut du segment d'arrivee`,
           `${debut.toExponential(2)} contre ${dedans.toExponential(2)} une fois rentre` +
           ` (${(debut / dedans).toFixed(1)}x)`);
        ok(dedans < debut * 0.5, `${nom} : et rentrer REFERME les aigus`,
           `${debut.toExponential(2)} -> ${dedans.toExponential(2)}` +
           ` (${(100 * dedans / debut).toFixed(0)} %)`);
      }
      void h; void segs;
      return serie;
    }
    await suivreExcursion('06-salle-sport', '07-yoga', 'le jardin (vitrage)');
    await suivreExcursion('10-balcon', '11-montee-toit', 'le parc (baie ouverte)');
  }

  // --- 5. La bascule silence -------------------------------------------------
  // ON REMONTE D'ABORD DANS UN SEGMENT QUI SONNE FRANCHEMENT, et le choix n'est
  // pas indifferent. Tester depuis l'ecran des faits ne prouverait rien -- il
  // est silencieux par construction. Et la FIN de la piscine ne vaut pas mieux :
  // `tairAvantLaVille` y eteint les insectes a partir de t = 0,88 et le mix y
  // tombe a -85 dB, ce qui est voulu -- c'est ce silence qui prepare le noir des
  // faits. On remonte donc jusqu'au restaurant, dont la musique et les voix
  // tiennent un niveau franc sur tout le segment.
  console.log('\n5. la bascule silence');
  for (let etape = 0; etape < 60; etape++) {
    await nav.evaluer(POUSSER(6, -350));
    if ((await nav.evaluer(SEGMENT)) === '12-restaurant') break;
  }
  await dormir(2500);
  const avantBascule = await nav.evaluer(MESURER(400));
  ok(avantBascule.db > -70, 'on est revenu dans un segment qui sonne',
     `${avantBascule.db.toFixed(1)} dB`);
  await nav.evaluer(`document.getElementById('son').click(), true`);
  await dormir(1500);
  const coupe = await nav.evaluer(MESURER(500));
  ok(coupe.db < -55, 'le bus se ferme', `${coupe.db.toFixed(1)} dB`);
  // Les pistes ne doivent PAS s'arreter : les redemarrer les remettrait en
  // phase et l'on entendrait leur simultaneite.
  const tournent = await nav.evaluer(
    `window.__son.contexte.state === 'running'`);
  ok(tournent, 'le contexte continue de tourner : les pistes gardent leur phase');
  await nav.evaluer(`document.getElementById('son').click(), true`);
  await dormir(2000);
  const revenu = await nav.evaluer(MESURER(500));
  ok(revenu.db > coupe.db + 6, 'le son revient', `${revenu.db.toFixed(1)} dB`);

  // --- 6. Ce que la page a dit -----------------------------------------------
  console.log('\n6. ce que la page a dit');
  const graves = nav.journal.filter(
    (l) => l.type === 'exception' || l.type === 'error' || l.type === 'reseau');
  ok(graves.length === 0, 'aucune erreur, exception ni requete en echec');
  for (const l of nav.journal.slice(0, 12)) {
    console.log(`     [${l.type}] ${l.texte.slice(0, 150)}`);
  }

  writeFileSync(`${SORTIE}/releves.json`,
                JSON.stringify({ releves, journal: nav.journal }, null, 1));
  console.log(`\nreleves dans ${SORTIE}`);
} finally {
  await nav.fermer();
}

console.log(`\n${echecs === 0 ? 'TOUT PASSE' : echecs + ' ECHEC(S)'}\n`);
process.exit(echecs === 0 ? 0 : 1);
