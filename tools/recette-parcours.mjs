// Banc du parcours : on FAIT DEFILER le vrai site et l'on regarde ce qui sort.
//
//   python tools/serve.py &
//   node tools/recette-parcours.mjs
//
// Il ne teste pas des modules isoles : il ouvre la page telle qu'elle sera
// servie, pousse le VRAI moteur de defilement avec de vrais evenements de
// molette, et releve a chaque etape le segment atteint, la luminosite appliquee
// et l'aspect reel de l'ecran.
//
// Trois lecons de la passation sont appliquees ici.
//
//   piege 6   ne pas dependre d'une horloge virtuelle. Sous
//             `--virtual-time-budget`, `createImageBitmap` n'avance jamais : la
//             promesse ne se resout pas et le banc s'arrete sans message. On
//             pilote donc en temps reel (tools/pilote.mjs). Verifie sur cette
//             machine : la sonde restait bloquee sur « en cours ».
//   piege 7   ne pas inventer les vitesses. On envoie des `deltaY` dans le vrai
//             integrateur et l'on laisse le moteur produire ce qu'il produit.
//   piege 32  ne pas lire le canvas WebGL par `drawImage` depuis la page : il
//             rend du noir faute de `preserveDrawingBuffer`, et l'on conclut a
//             tort que le bassin ne peint rien. On mesure sur une capture du
//             NAVIGATEUR, qui composite correctement.
//
// ECHANTILLONNAGE. Un cran de molette a 150 de delta vaut 750 px/s d'impulsion,
// que l'amortissement a 2,6 etale sur environ 290 px de course. Le parcours
// entier fait 88 hauteurs d'ecran. Un pas de banc trop gros saute des segments
// entiers : ce n'est pas le site qui les manque, c'est le banc qui ne les
// regarde pas. On passe donc en deux temps -- un balayage large pour la
// couverture, puis un balayage FIN la ou un mecanisme precis doit etre vu.

import { mkdirSync, writeFileSync } from 'node:fs';
import { ouvrirNavigateur, dormir } from './pilote.mjs';

const BASE = process.env.BASE || 'http://localhost:8000';
const SORTIE = process.env.SORTIE || './build/recette-parcours';
const ZONE = { x: 0, y: 90, width: 1280, height: 540 };   // la bande d'image

let echecs = 0;
const ok = (c, quoi, detail = '') => {
  if (!c) echecs++;
  console.log(`  ${c ? 'ok  ' : 'ECHEC'} ${quoi}${detail ? '   ' + detail : ''}`);
};

const POUSSER = (n, delta) => `
  (async () => {
    for (let k = 0; k < ${n}; k++) {
      window.dispatchEvent(new WheelEvent('wheel', { deltaY: ${delta}, bubbles: true, cancelable: true }));
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    }
    await new Promise(r => setTimeout(r, 200));
    return true;
  })()`;

const ETAT = `(() => {
  const t = document.getElementById('temoin').textContent;
  const c = document.getElementById('scene');
  return {
    segment: (t.split('—').pop() || '').trim(),
    canvas: c.hidden ? 'eau' : 'scene',
    filtre: getComputedStyle(c).filter,
    aria: c.getAttribute('aria-label'),
  };
})()`;

/** Remet le parcours au depart. `Home` saute et remet les vitesses a zero. */
const AU_DEPART = `(async () => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
  await new Promise(r => setTimeout(r, 400));
  return true;
})()`;

const nav = await ouvrirNavigateur({ largeur: 1280, hauteur: 720 });
mkdirSync(SORTIE, { recursive: true });

try {
  console.log(`\nbanc du parcours — ${BASE}\n`);
  // MODE NORMAL FORCE. Sous rendu logiciel la page bascule d'elle-meme en
  // degrade avant d'atteindre la piscine -- c'est le mecanisme qui fonctionne,
  // mais `cfg.eau` passe alors a faux et le bassin ne se cree jamais. On ne
  // pourrait plus le tester. Le mode degrade a son propre controle, plus bas.
  await nav.aller(`${BASE}/?degraded=0&eau=1`);
  await dormir(1500);

  // ON ENTRE PAR LA PORTE, et EN SILENCE. Le defilement n'est rendu qu'a la fin
  // de l'amorce : sans ce clic, tout ce banc pousserait dans le vide et
  // conclurait que le moteur ne repond pas.
  //
  // En silence plutot qu'avec le son parce que l'amorce y est jouee a
  // INTRO_FACTEUR_SILENCE, soit 55 % de sa duree : le banc gagne quatre
  // secondes a chaque passage, et ce qu'il mesure ici est l'image, pas le son.
  // Le son a son propre banc.
  await nav.evaluer(`document.querySelector('[data-son="non"]').click(), true`);
  for (let attente = 0; attente < 40; attente++) {
    await dormir(400);
    if ((await nav.evaluer(
      `document.getElementById('porte').dataset.etat`)) === 'fini') break;
  }
  ok((await nav.evaluer(`document.getElementById('porte').dataset.etat`)) === 'fini',
     'la porte a rendu la main');
  await dormir(600);

  console.log('1. l\'arrivee');
  const premier = await nav.evaluer(ETAT);
  const mPremier = await nav.mesurerZone(ZONE);
  ok(premier.segment === '01-facade', 'on arrive sur 01-facade', premier.segment);
  ok(mPremier.luminance > 2, 'la premiere image est peinte, pas un ecran noir',
     `luminance ${mPremier.luminance.toFixed(1)}`);
  ok(premier.canvas === 'scene', 'le canvas 2D a la main');
  await nav.photo(`${SORTIE}/00-arrivee.png`);

  // --- 2. la traversee, assez fine pour ne sauter aucun segment -------------
  console.log('\n2. la traversee des quatorze segments');
  const vus = new Map([[premier.segment, { ...premier, ...mPremier }]]);
  const releves = [{ ...premier, ...mPremier }];
  for (let etape = 0; etape < 150; etape++) {
    await nav.evaluer(POUSSER(3, 150));
    const e = await nav.evaluer(ETAT);
    const m = await nav.mesurerZone(ZONE);
    const r = { ...e, ...m };
    releves.push(r);
    if (!vus.has(e.segment)) {
      vus.set(e.segment, r);
      const n = String(vus.size).padStart(2, '0');
      await nav.photo(`${SORTIE}/${n}-${e.segment}.png`);
      console.log(`     ${n}  ${e.segment.padEnd(16)} lum ${m.luminance.toFixed(1).padStart(6)}` +
                  `  ecart ${m.ecart.toFixed(1).padStart(5)}  ${e.canvas}`);
    }
    if (e.segment === 'faits') break;
  }

  const ATTENDUS = ['01-facade','02-approche','03-hall','04-spa','05-velos',
                    '06-salle-sport','07-yoga','08-salon','09-chambre','10-balcon',
                    '11-montee-toit','12-restaurant','13-piscine','faits'];
  for (const a of ATTENDUS) ok(vus.has(a), `${a} atteint`);

  console.log('\n3. aucun ecran noir inattendu');
  for (const a of ATTENDUS) {
    if (a === 'faits') continue;               // le noir y est le sujet
    const e = vus.get(a);
    if (e) ok(e.luminance > 2, `${a} est peint`, `luminance ${e.luminance.toFixed(1)}`);
  }

  // --- 4. le noir du spa, balaye FINEMENT -----------------------------------
  // Une extinction occupe 30 a 40 pour cent d'un segment, soit un a deux pour
  // cent du parcours entier : le balayage large ne peut pas la voir, et
  // conclure de son silence que le noir n'existe pas serait une faute de banc.
  console.log('\n4. les DEUX noirs du parcours, au balayage fin');
  // Le pas doit etre plus PETIT que le mecanisme observe, sinon l'absence de
  // releve ne prouve rien. Une tenue vaut 8 a 12 % d'un segment, soit quelques
  // centaines de pixels ; un cran a 150 de delta en vaut deja 290. On descend
  // donc a 60, soit une centaine de pixels.
  // DEUX noirs sur le parcours, et ils ne disent pas la meme chose. Celui de
  // l'approche fait ENTRER dans le batiment -- on se reveille a l'interieur.
  // Celui du spa separe deux lieux. Les deux se verifient de la meme facon.
  const val = (f) => {
    const m = /brightness\(([\d.]+)\)/.exec(f || '');
    return m ? parseFloat(m[1]) : 1;
  };

  async function verifierNoir(quiEteint, quiRallume, apres, nom) {
    await nav.evaluer(AU_DEPART);
    const releve = [];
    for (let etape = 0; etape < 700; etape++) {
      await nav.evaluer(POUSSER(1, 60));
      const e = await nav.evaluer(ETAT);
      if (e.segment === quiEteint || e.segment === quiRallume) {
        const m = await nav.mesurerZone(ZONE);
        releve.push({ ...e, ...m });
      }
      if (e.segment === apres) break;
    }
    const av = releve.filter((e) => e.segment === quiEteint).map((e) => val(e.filtre));
    const ap = releve.filter((e) => e.segment === quiRallume).map((e) => val(e.filtre));
    console.log(`     ${nom}`);
    console.log(`       ${quiEteint.padEnd(14)} ${av.map((v) => v.toFixed(2)).join(' ')}`);
    console.log(`       ${quiRallume.padEnd(14)} ${ap.map((v) => v.toFixed(2)).join(' ')}`);
    ok(av.length > 0, `${nom} : ${quiEteint} a ete balaye`);
    ok(av.some((v) => v < 1), `${nom} : ${quiEteint} s'eteint`);
    ok(av.some((v) => v === 0), `${nom} : le noir est ATTEINT`);
    ok(av.filter((v) => v === 0).length > 1,
       `${nom} : le noir est TENU et non traverse en une trame`,
       `${av.filter((v) => v === 0).length} releves au noir`);
    ok(ap.length > 0 && ap[0] < 1,
       `${nom} : ${quiRallume} entre en remontant du noir`, String(ap[0]));
    ok(ap.some((v) => v === 1), `${nom} : et retrouve sa pleine luminosite`);
    const noirs = releve.filter((e) => e.segment === quiEteint && val(e.filtre) === 0);
    if (noirs.length) {
      ok(noirs[0].luminance < 3, `${nom} : l'ecran est reellement noir`,
         `luminance mesuree ${noirs[0].luminance.toFixed(2)}`);
    }
    return releve;
  }

  const seuil = await verifierNoir('02-approche', '03-hall', '04-spa',
                                   'le seuil du batiment');
  const fin = await verifierNoir('04-spa', '05-velos', '06-salle-sport',
                                 'le noir du spa');
  void seuil;

  // --- 5. le bassin ---------------------------------------------------------
  // On avance jusqu'a ENTRER dans la piscine, puis on la balaie finement. Le
  // segment fait douze hauteurs d'ecran : le traverser au pas large ne donne
  // que quatre releves, et l'on manquerait la nuit qui tombe -- qui est
  // justement ce qu'on veut voir.
  console.log('\n5. le bassin');
  await nav.evaluer(AU_DEPART);
  let entre = false;
  for (let etape = 0; etape < 400 && !entre; etape++) {
    await nav.evaluer(POUSSER(4, 150));
    entre = (await nav.evaluer(ETAT)).segment === '13-piscine';
  }
  ok(entre, 'la piscine est atteinte');

  const eaux = [];
  for (let etape = 0; etape < 120; etape++) {
    const e = await nav.evaluer(ETAT);
    if (e.segment !== '13-piscine') break;
    const m = await nav.mesurerZone(ZONE);
    eaux.push({ ...e, ...m });
    if (eaux.length === 2) await nav.photo(`${SORTIE}/bassin-jour.png`);
    // La photo de nuit se prend DANS la boucle, a chaque tour : celle qui reste
    // est donc la derniere prise a l'interieur du plan. Prise apres la boucle,
    // elle tombait sur l'ecran des faits -- une image toute noire, presentee
    // comme « le bassin de nuit ».
    await nav.photo(`${SORTIE}/bassin-nuit.png`);
    await nav.evaluer(POUSSER(2, 150));
  }
  const surEau = eaux.filter((e) => e.canvas === 'eau');
  console.log(`     ${eaux.length} releves dans la piscine, dont ${surEau.length} sur le canvas WebGL`);
  ok(surEau.length > 0, 'le canvas WebGL prend la main', `${surEau.length} releves`);
  ok(surEau.every((e) => e.luminance > 2), 'le bassin peint a chaque releve',
     `luminance min ${Math.min(...surEau.map((e) => e.luminance)).toFixed(1)}`);
  if (surEau.length > 3) {
    const a = surEau[0].luminance;
    const z = Math.min(...surEau.map((e) => e.luminance));
    ok(z < a * 0.75, 'la nuit tombe sur le bassin', `${a.toFixed(1)} -> ${z.toFixed(1)}`);

    // ET ELLE NE SE RELEVE PAS. C'est ce qui a attrape un vrai defaut : en
    // quittant la piscine, l'orchestration rendait la main au canvas 2D, qui
    // tenait encore la piscine EN PLEIN JOUR -- la derniere image qu'il eut
    // peinte avant que le bassin ne prenne le relais. Pendant la demi-hauteur
    // d'ecran ou le noir des faits s'installe, on voyait donc le plan repasser
    // de la nuit au jour.
    //
    // Le critere : une fois le minimum atteint, plus aucun relevé ne doit
    // remonter franchement. Une remontee de plus de moitie est un retour en
    // arriere dans le temps du plan, jamais un effet voulu.
    const iMin = surEau.findIndex((e) => e.luminance === z);
    const apres = surEau.slice(iMin + 1);
    const remontee = apres.length ? Math.max(...apres.map((e) => e.luminance)) : z;
    ok(remontee < z * 1.5, 'et elle ne se releve pas apres coup',
       `minimum ${z.toFixed(1)}, puis ${remontee.toFixed(1)}`);
  }

  // --- 6. l'eau repond a la main -------------------------------------------
  // On REVIENT dans la piscine : le balayage precedent en est sorti, et tester
  // le pointeur depuis l'ecran des faits ne prouverait rien.
  console.log('\n6. l\'eau repond a la main, et continue sans elle');
  await nav.evaluer(AU_DEPART);
  let dedans = false;
  for (let etape = 0; etape < 400 && !dedans; etape++) {
    await nav.evaluer(POUSSER(4, 150));
    const e = await nav.evaluer(ETAT);
    dedans = e.segment === '13-piscine' && e.canvas === 'eau';
  }
  // Un peu plus loin dans le plan, pour etre franchement au-dela du fondu.
  await nav.evaluer(POUSSER(6, 150));
  ok(dedans, 'le bassin a la main pour recevoir le pointeur');

  if (dedans) {
    const bouge = await nav.evaluer(`(async () => {
      const c = document.getElementById('eau');
      if (c.hidden) return { erreur: 'le bassin a perdu la main' };
      const r = c.getBoundingClientRect();
      const env = (x, y) => c.dispatchEvent(new PointerEvent('pointermove', {
        clientX: r.left + x, clientY: r.top + y, bubbles: true }));
      for (let k = 0; k <= 30; k++) {
        env(r.width * (0.28 + 0.44 * k / 30), r.height * 0.66);
        await new Promise(res => requestAnimationFrame(res));
      }
      return { ok: true };
    })()`);
    ok(!bouge.erreur, 'le geste a ete recu', bouge.erreur || '');
    const a = await nav.mesurerZone(ZONE);
    await nav.photo(`${SORTIE}/bassin-sillage.png`);
    await dormir(600);
    const b = await nav.mesurerZone(ZONE);
    // L'eau doit CONTINUER de bouger apres le passage : c'est tout le sujet de
    // cet ecran, et ce sont les gouttes ambiantes qui le garantissent.
    const change = Math.abs(a.luminance - b.luminance) + Math.abs(a.ecart - b.ecart);
    ok(change > 0.002,
       'l\'image change encore six dixiemes de seconde apres le geste',
       `lum ${a.luminance.toFixed(3)} -> ${b.luminance.toFixed(3)}, ` +
       `ecart ${a.ecart.toFixed(3)} -> ${b.ecart.toFixed(3)}`);
  }

  // --- 7. le retour en arriere ---------------------------------------------
  console.log('\n7. le retour en arriere');
  await nav.evaluer(POUSSER(40, -400));
  const retour = await nav.evaluer(ETAT);
  const mRetour = await nav.mesurerZone(ZONE);
  ok(mRetour.luminance > 2, 'le retour ne fige pas l\'ecran',
     `${retour.segment}, luminance ${mRetour.luminance.toFixed(1)}`);
  await nav.photo(`${SORTIE}/99-retour.png`);

  // --- 7 bis. le mode degrade -------------------------------------------------
  // Il ne se code pas a la fin, et il ne se verifie pas a la fin non plus : une
  // protection jamais declenchee pendant le developpement ne protege rien. On
  // le force explicitement et l'on regarde ce qu'il change.
  console.log('\n7 bis. le mode degrade');
  {
    await nav.aller(`${BASE}/?degraded=1`);
    await dormir(1500);
    await nav.evaluer(`document.querySelector('[data-son="non"]').click(), true`);
    for (let a = 0; a < 40; a++) {
      await dormir(400);
      if ((await nav.evaluer(
        `document.getElementById('porte').dataset.etat`)) === 'fini') break;
    }
    await dormir(600);
    const t = await nav.evaluer(`document.getElementById('temoin').textContent`);
    ok(/degrade/.test(t), 'le mode degrade est actif', t.slice(0, 70));
    ok(/1\/2/.test(t), 'une image sur deux seulement est decodee');
    const m = await nav.mesurerZone(ZONE);
    ok(m.luminance > 2, 'et la page reste PEINTE : c\'est une version, pas une panne',
       `luminance ${m.luminance.toFixed(1)}`);
    await nav.photo(`${SORTIE}/degrade.png`);

    // LE BASSIN N'EST PLUS COUPE PAR LE MODE DEGRADE, il se retire tout seul.
    //
    // L'ancienne regle -- « aucun bassin WebGL en mode degrade » -- reposait sur
    // une presomption : que l'appareil qui peine a DECODER peine aussi a
    // DESSINER. Elle n'etait verifiable sur aucun banc, parce qu'un banc rend le
    // GPU en logiciel. Elle retirait donc le final du site a des appareils dont
    // on ne savait rien.
    //
    // Ce qui se verifie, en revanche, c'est la COHERENCE : le temoin dit ce que
    // l'eau fait, et le canvas a l'ecran doit le confirmer. Sous rasteriseur
    // logiciel la piscine ne tient pas trente images par seconde, donc l'eau se
    // retire ici -- et c'est la ce banc mesure : que le retrait rende bien
    // l'ecran au canvas 2D, sans le laisser noir.
    let atteint = false;
    for (let etape = 0; etape < 300 && !atteint; etape++) {
      await nav.evaluer(POUSSER(4, 150));
      const e = await nav.evaluer(ETAT);
      if (e.segment === '13-piscine') {
        await nav.evaluer(POUSSER(6, 150));
        // Le retrait se prononce sur trois secondes de cadence : on les laisse
        // passer avant de juger, sinon on lit un etat de transition.
        await dormir(4500);
        const f = await nav.evaluer(ETAT);
        const t2 = await nav.evaluer(`document.getElementById('temoin').textContent`);
        const retiree = /retiree/.test(t2);
        ok(retiree ? f.canvas === 'scene' : f.canvas === 'eau',
           'le temoin et l\'ecran disent la meme chose sur l\'eau',
           `${retiree ? 'retiree' : 'posee'}, canvas ${f.canvas}`);
        const mm = await nav.mesurerZone(ZONE);
        ok(mm.luminance > 2, 'et la piscine reste PEINTE quoi qu\'il arrive',
           `luminance ${mm.luminance.toFixed(1)}`);
        await nav.photo(`${SORTIE}/degrade-piscine.png`);
        atteint = true;
      }
      if (e.segment === 'faits') break;
    }
    ok(atteint, 'la piscine est atteignable en mode degrade');
  }

  // --- 8. le journal --------------------------------------------------------
  console.log('\n8. ce que la page a dit');
  const graves = nav.journal.filter(
    (l) => l.type === 'exception' || l.type === 'error' || l.type === 'reseau');
  ok(graves.length === 0, 'aucune erreur, exception ni requete en echec');
  for (const l of nav.journal.slice(0, 15)) {
    console.log(`     [${l.type}] ${l.texte.slice(0, 150)}`);
  }

  writeFileSync(`${SORTIE}/releves.json`,
                JSON.stringify({ releves, fin, eaux, journal: nav.journal }, null, 1));
  console.log(`\nimages et releves dans ${SORTIE}`);
} finally {
  await nav.fermer();
}

console.log(`\n${echecs === 0 ? 'TOUT PASSE' : echecs + ' ECHEC(S)'}\n`);
process.exit(echecs === 0 ? 0 : 1);
