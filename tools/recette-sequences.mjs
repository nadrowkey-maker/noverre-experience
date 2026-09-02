// Banc d'acceptation de la carte des sequences.
//
//   node tools/recette-sequences.mjs
//
// Il IMPORTE les modules et teste les valeurs. Il ne cherche pas des `export`
// par expression reguliere : sur Parkside, un banc qui faisait cela a signale
// 37 echecs, tous faux. Un banc qui ment est pire qu'aucun banc, parce qu'on
// va le croire.
//
// Ce qu'il verifie, et pourquoi chaque point est ici :
//
//   - le nombre d'images declare correspond aux fichiers REELLEMENT sur le
//     disque. Une image de trop et la derniere du segment est un 404 ; une de
//     moins et l'on n'atteint jamais la fin du plan ;
//   - la grammaire des raccords est complete des DEUX cotes. C'est le piege 14 :
//     une extinction sans rallumage laisse le segment suivant en plein noir, un
//     rallumage sans `fonduEnchaine: 0` fait remonter deux mouvements
//     contradictoires ;
//   - `couches` est present sur chaque segment, meme vide, parce que la couche
//     sonore viendra se poser dedans ;
//   - aucun champ `fondanteEntree` / `fondanteSortie` ne traine. Ceux de
//     Parkside n'etaient lus par AUCUN code et donnaient l'illusion de regler
//     quelque chose.

import { readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');

const { SEQUENCES, FAITS, PORTE, FACADE, imageGlobale } =
  await import('../src/config/sequences.js');
const { PISTES } = await import('../src/config/audio.js');
const { luminositePour } = await import('../src/frames/transitions.js');
const { ECRANS_PAR_SEQUENCE, PART_FONDU_ENCHAINE } =
  await import('../src/config/constants.js');

let echecs = 0;
const ok = (cond, quoi, detail = '') => {
  if (!cond) echecs++;
  console.log(`  ${cond ? 'ok  ' : 'ECHEC'} ${quoi}${detail ? '   ' + detail : ''}`);
};
const titre = (t) => console.log(`\n${t}`);

// --- 1. La forme ------------------------------------------------------------
titre('1. la forme');
ok(SEQUENCES.length === 13, 'treize segments d\'image', `${SEQUENCES.length}`);
ok(FAITS.sansImage === true, 'l\'ecran final est sansImage');
ok(FAITS.couches && Object.keys(FAITS.couches).length === 0,
   'l\'ecran final a des couches vides');

const ids = SEQUENCES.map((s) => s.id);
ok(new Set(ids).size === ids.length, 'aucun identifiant en double');
ok(ids.every((id, i) => id.startsWith(String(i + 1).padStart(2, '0') + '-')),
   'les identifiants suivent l\'ordre du parcours');

// --- 2. La couche sonore ------------------------------------------------------
titre('2. la couche sonore');
for (const s of SEQUENCES) {
  ok(s.couches !== undefined && typeof s.couches === 'object',
     `${s.id} porte un champ couches`);
}

// TOUTE piste citee doit exister dans PISTES, sinon `banque.obtenir` leve
// `piste inconnue` -- a l'execution, dans la scene concernee, donc peut-etre
// quatre minutes apres le chargement. C'est exactement le genre de defaut qu'un
// banc doit attraper avant le navigateur.
{
  const connues = new Set(Object.keys(PISTES));
  const citees = new Map();          // nom -> ou il est cite
  const citer = (nom, ou) => {
    if (!citees.has(nom)) citees.set(nom, []);
    citees.get(nom).push(ou);
  };
  for (const s of [...SEQUENCES, PORTE, FAITS]) {
    for (const n of Object.keys(s.couches || {})) citer(n, `couche de ${s.id}`);
    for (const d of s.declencheurs || []) citer(d.son, `declencheur de ${s.id}`);
    for (const n of s.scellement?.pistes || []) citer(n, `scellement de ${s.id}`);
    if (s.rideau?.pisteDehors) citer(s.rideau.pisteDehors, `rideau de ${s.id}`);
  }
  for (const n of Object.keys(FACADE.dehors)) citer(n, 'FACADE.dehors');
  if (FACADE.pisteInterieure) citer(FACADE.pisteInterieure, 'FACADE.pisteInterieure');

  // Trois pistes ne sont citees par AUCUNE couche, et c'est voulu : elles
  // appartiennent a un comportement, qui les possede et les pilote seul.
  //
  //   musique-velos  la chaine des velos. Ce n'est pas une couche parce qu'une
  //                  couche est coupee a la frontiere par `taire()`, et la
  //                  pente des trois salles s'appliquerait alors au silence.
  //   eau            le bassin, pilote par la MAIN et non par le defilement.
  //   rideau         son volume suit la VITESSE d'ouverture, pas la position.
  //
  // On les compte comme citees quand un segment declare le comportement qui les
  // possede : c'est cela qui les rend effectivement jouees.
  for (const s of SEQUENCES) {
    if (s.velos || s.distanceVelos) citer('musique-velos', `chaine des velos (${s.id})`);
    if (s.eau) citer('eau', `comportement eau (${s.id})`);
    if (s.rideau) citer('rideau', `comportement rideau (${s.id})`);
  }

  const inconnues = [...citees.keys()].filter((n) => !connues.has(n));
  ok(inconnues.length === 0, 'toute piste citee existe dans PISTES',
     inconnues.map((n) => `${n} (${citees.get(n)[0]})`).join(', '));

  // Une piste declaree que personne n'utilise est du poids livre pour rien.
  const orphelines = [...connues].filter((n) => !citees.has(n));
  ok(orphelines.length === 0, 'aucune piste declaree mais jamais citee',
     orphelines.join(', '));
}

// Les niveaux sont en DECIBELS, jamais en lineaire. Un niveau positif ou un
// 0..1 qui traine serait un gain lineaire deguise, et il s'entendrait tout de
// suite -- c'est le piege 16, une musique qui part a pleine puissance.
{
  const suspects = [];
  const controler = (v, ou) => {
    if (typeof v !== 'number') return;
    if (v > 0 || v < -80) suspects.push(`${ou} = ${v}`);
  };
  for (const s of [...SEQUENCES, PORTE]) {
    for (const [n, c] of Object.entries(s.couches || {})) {
      if (typeof c === 'number') { controler(c, `${s.id}/${n}`); continue; }
      controler(c.debut, `${s.id}/${n}.debut`);
      controler(c.fin, `${s.id}/${n}.fin`);
      controler(c.dbBosse, `${s.id}/${n}.dbBosse`);
    }
  }
  ok(suspects.length === 0, 'tous les niveaux sont des decibels plausibles',
     suspects.join(', '));
}

// La porte joue DEJA quelque chose : celui qui choisit le silence doit l'avoir
// entendu une fois.
ok(Object.keys(PORTE.couches).length > 0,
   'la porte porte une couche sous ses deux boutons',
   JSON.stringify(PORTE.couches));
ok(Object.keys(FAITS.couches).length === 0,
   'l\'ecran des faits est SILENCIEUX',
   'apres quatre minutes, le silence est la chose la plus forte de la page');

// --- 2 bis. Les traversees de facade -----------------------------------------
titre('2 bis. les traversees de facade');
{
  const declarees = SEQUENCES.filter((s) => s.traversee);
  ok(declarees.length === 4, 'quatre segments participent a une excursion',
     declarees.map((s) => s.id).join(', '));
  ok(FACADE.passages.length === 2, 'deux excursions declarees');

  // Les intervalles doivent etre valides et disjoints, sinon l'etat « dehors »
  // n'a plus de sens.
  let bon = true;
  for (const p of FACADE.passages) if (!(p.sortie < p.retour)) bon = false;
  ok(bon, 'chaque excursion sort avant de rentrer',
     FACADE.passages.map((p) => `${p.sortie}->${p.retour}`).join(', '));
  const [a, b] = FACADE.passages;
  ok(a.retour <= b.sortie, 'les deux excursions ne se recouvrent pas');

  // Chaque intervalle doit tomber DANS les segments qui le declarent : un seuil
  // pose hors du segment ne se franchirait jamais.
  const bornes = (id) => [imageGlobale(id, 1),
                          imageGlobale(id, SEQUENCES.find((s) => s.id === id).frames)];
  const dans = (v, [d, f]) => v >= d && v <= f;
  ok(dans(a.sortie, bornes('06-salle-sport')), 'la sortie du jardin est dans 06');
  ok(dans(a.retour, bornes('07-yoga')), 'le retour du jardin est dans 07');
  ok(dans(b.sortie, bornes('10-balcon')), 'la sortie du parc est dans 10');
  ok(dans(b.retour, bornes('11-montee-toit')), 'le retour du parc est dans 11');

  // PIEGE 1 DE LA §6.7 : la piste interieure ne doit JAMAIS etre une couche
  // d'un segment qui traverse. Le melangeur tourne AVANT les comportements et
  // la remettrait a son niveau a chaque trame -- impossible alors de la couper
  // pendant qu'on est dehors. Le defaut est silencieux : tout a l'air branche.
  const fautives = declarees.filter(
    (s) => FACADE.pisteInterieure in (s.couches || {})
        || Object.keys(FACADE.dehors).some((n) => n in (s.couches || {})));
  ok(fautives.length === 0,
     'aucun segment qui traverse ne declare les pistes de la traversee en couche',
     fautives.map((s) => s.id).join(', '));
}

// --- 2 ter. La narration ------------------------------------------------------
titre('2 ter. la narration');
{
  const { opacitePour } = await import('../src/ui/narration.js');
  const tous = [...SEQUENCES, FAITS];
  ok(tous.every((s) => s.narration && s.narration.texte),
     'les quatorze ecrans portent une ligne',
     tous.filter((s) => !s.narration?.texte).map((s) => s.id).join(', '));

  // L'arche ne tient que si les treize sont la, dans cet ordre. Un doublon ou
  // une ligne manquante casse le recit sans casser le code.
  const lignes = tous.map((s) => s.narration?.texte).filter(Boolean);
  ok(new Set(lignes).size === lignes.length, 'aucune ligne en double');

  // Mesure bornee : deux lignes maximum a environ quarante caracteres, jamais
  // trois. La plus longue en fait cinquante-quatre.
  const trop = lignes.filter((l) => l.length > 80);
  ok(trop.length === 0, 'aucune ligne ne depasse deux mesures de quarante',
     trop.join(' | '));

  // « you » n'apparait qu'UNE SEULE FOIS dans tout le site, a l'avant-dernier
  // ecran. C'est delibere et ca ne se negocie pas.
  const avecYou = tous.filter((s) => /\byou\b|\byour\b/i.test(s.narration?.texte || ''));
  ok(avecYou.length === 1 && avecYou[0].id === '13-piscine',
     'le mot « you » n\'apparait qu\'une fois, sur la piscine',
     avecYou.map((s) => s.id).join(', ') || 'jamais');

  // Aucun nom de piece, aucune surface, aucun sous-titre explicatif.
  const INTERDITS = /\b(spa|yoga|gym|lobby|pool|balcony|bedroom|m²|sq ?ft|scroll)\b/i;
  const bavardes = tous.filter((s) => INTERDITS.test(s.narration?.texte || ''));
  ok(bavardes.length === 0, 'aucun nom de piece ni indication d\'interface',
     bavardes.map((s) => s.id).join(', '));

  // LA PHRASE COUPEE PAR LE NOIR. C'est elle qui transforme treize plans en un
  // recit : si la reponse arrivait tard, la phrase ne se refermerait pas.
  const velos = SEQUENCES.find((s) => s.id === '05-velos');
  ok(velos.narration.a <= 0.15,
     'la reponse des velos arrive TOT, pour refermer la phrase du spa',
     `a = ${velos.narration.a}`);

  // La piscine ne disparait pas : c'est une consigne, pas une legende.
  const piscine = SEQUENCES.find((s) => s.id === '13-piscine');
  ok(piscine.narration.persistant === true,
     'la ligne de la piscine est persistante');
  ok(opacitePour(piscine.narration, 0.999) === 1,
     'et elle est encore pleine a la derniere image du segment');

  // Les douze autres se retirent. Une ligne qui resterait par erreur se
  // superposerait a la suivante au raccord.
  const restantes = SEQUENCES.filter(
    (s) => !s.narration.persistant && opacitePour(s.narration, 1) > 0.01);
  ok(restantes.length === 0, 'les douze autres se sont retirees a la fin du segment',
     restantes.map((s) => s.id).join(', '));

  // La forme de la rampe, calculee et non supposee.
  const f = SEQUENCES[0].narration;
  ok(opacitePour(f, f.a - 0.07) === 0, 'nulle avant la rampe d\'entree');
  ok(opacitePour(f, f.a) === 1, 'pleine a `a`');
  ok(opacitePour(f, f.a + f.tenue) === 1, 'encore pleine a la fin de la tenue');
  ok(opacitePour(f, f.a + f.tenue + 0.09) === 0, 'nulle apres la rampe de sortie');
  // Mouvement reduit : plein des l'entree dans la fenetre, et ca ne disparait
  // pas. C'est une version, pas une punition.
  ok(opacitePour(f, f.a - 0.03, true) === 1, 'en mouvement reduit, pleine sans rampe');
  ok(opacitePour(f, 1, true) === 1, 'en mouvement reduit, elle ne disparait pas');
}

// --- 3. Les vestiges a ne pas reprendre --------------------------------------
titre('3. les vestiges de Parkside');
const vestiges = SEQUENCES.filter(
  (s) => 'fondanteEntree' in s || 'fondanteSortie' in s);
ok(vestiges.length === 0,
   'aucun fondanteEntree / fondanteSortie (ils ne sont lus par aucun code)',
   vestiges.map((s) => s.id).join(', '));

// --- 4. Le nombre d'images contre le disque ----------------------------------
titre('4. le nombre d\'images declare contre les fichiers sur le disque');
for (const s of SEQUENCES) {
  for (const jeu of ['webp-1280', 'webp-854']) {
    const dir = join(RACINE, 'frames', jeu, s.id);
    if (!existsSync(dir)) {
      console.log(`  ....  ${s.id} / ${jeu} : pas encore encode`);
      continue;
    }
    const n = readdirSync(dir).filter((f) => f.endsWith('.webp')).length;
    ok(n === s.frames, `${s.id} / ${jeu}`, `declare ${s.frames}, sur le disque ${n}`);
    // La numerotation est en base 1 sur quatre chiffres : la premiere et la
    // derniere doivent exister, sinon le segment commence ou finit sur un 404.
    ok(existsSync(join(dir, '0001.webp')), `${s.id} / ${jeu} : 0001.webp existe`);
    const derniere = String(s.frames).padStart(4, '0') + '.webp';
    ok(existsSync(join(dir, derniere)), `${s.id} / ${jeu} : ${derniere} existe`);
  }
}

// --- 5. La grammaire des raccords, des DEUX cotes ----------------------------
titre('5. les raccords, verifies des deux cotes');
SEQUENCES.forEach((s, i) => {
  const suivant = SEQUENCES[i + 1];
  if (s.extinctionSortie) {
    ok(s.extinctionSortie.tenue > 0,
       `${s.id} : l'extinction a une tenue`,
       'sans elle le noir est atteint et quitte dans la meme trame');
    ok(!!suivant, `${s.id} : une extinction a un segment apres elle`);
    if (suivant) {
      ok(!!suivant.allumageEntree,
         `${s.id} eteint -> ${suivant.id} rallume`,
         suivant.allumageEntree ? '' : 'sinon le segment suivant reste noir');
      ok(suivant.fonduEnchaine === 0,
         `${s.id} eteint -> ${suivant.id} a fonduEnchaine: 0`,
         suivant.fonduEnchaine === 0 ? ''
           : 'sinon on rallume tout en fondant et l\'on voit les deux');
    }
  }
  if (s.allumageEntree && i > 0) {
    ok(!!SEQUENCES[i - 1].extinctionSortie,
       `${s.id} rallume <- ${SEQUENCES[i - 1].id} eteint`,
       'on ne rallume que ce qui a ete eteint');
  }
});

// --- 6. Les raccords directs mesures -----------------------------------------
titre('6. les quatre raccords directs, tels que mesures');
const DIRECTS = new Set(['02-approche', '07-yoga', '11-montee-toit', '12-restaurant']);
// Directs pour cause d'EXTINCTION et non de contiguite : on ne rallume pas en
// fondant. Deux noirs sur le parcours -- le seuil du batiment, et le spa.
const AVEC_NOIR = new Set(['03-hall', '05-velos']);
SEQUENCES.forEach((s, i) => {
  if (i === 0) return;
  const direct = s.fonduEnchaine === 0;
  const attendu = DIRECTS.has(s.id) || AVEC_NOIR.has(s.id);
  ok(direct === attendu,
     `${SEQUENCES[i - 1].id} -> ${s.id}`,
     direct ? 'raccord direct' : `fondu enchaine ${s.fonduEnchaine ?? PART_FONDU_ENCHAINE}`);
});

// --- 7. La mise en route ------------------------------------------------------
titre('7. la mise en route');
const avecMER = SEQUENCES.filter((s) => s.miseEnRoute > 0);
ok(avecMER.length === 1 && avecMER[0].id === '02-approche',
   'une seule mise en route, sur 02-approche',
   avecMER.map((s) => `${s.id}=${s.miseEnRoute}`).join(', '));

// --- 8. Le rythme -------------------------------------------------------------
titre('8. le rythme');
let total = 0;
for (const s of [...SEQUENCES, FAITS]) {
  const e = s.ecrans ?? ECRANS_PAR_SEQUENCE;
  total += e;
  ok(e >= 3 && e <= 14, `${s.id} : ${e} ecrans`);
  if (s.imageFixe !== undefined && s.frames) {
    ok(s.imageFixe >= 1 && s.imageFixe <= s.frames,
       `${s.id} : imageFixe ${s.imageFixe} dans [1, ${s.frames}]`);
  }
}
console.log(`\n  parcours total : ${total} hauteurs d'ecran` +
            `  (${Math.round(total * 900)} px a 900 px d'ecran)`);

// --- 9. La luminosite reellement calculee -------------------------------------
titre('9. la courbe de luminosite, calculee et non supposee');
{
  const spa = SEQUENCES.find((s) => s.id === '04-spa');
  const velos = SEQUENCES.find((s) => s.id === '05-velos');
  const l = (s, t, o) => luminositePour(s, t, o);
  ok(l(spa, 0.5) === 1, 'le spa est intact a mi-segment');
  const debutDescente = 1 - spa.extinctionSortie.tenue - spa.extinctionSortie.part;
  ok(l(spa, debutDescente + 0.001) < 1, 'le spa commence a s\'eteindre');
  ok(l(spa, 1 - spa.extinctionSortie.tenue + 0.001) === 0, 'le spa atteint le noir');
  ok(l(spa, 0.999) === 0, 'le spa TIENT le noir jusqu\'a sa derniere image');
  ok(l(velos, 0) === 0, 'les velos entrent du noir');
  ok(l(velos, velos.allumageEntree.part + 0.001) === 1, 'les velos sont rallumes');
  // Le dernier segment ne s'eteint jamais : `derniere` neutralise l'extinction.
  ok(l(spa, 0.999, { derniere: true }) === 1,
     'le drapeau derniere neutralise l\'extinction');
}

console.log(`\n${echecs === 0 ? 'TOUT PASSE' : echecs + ' ECHEC(S)'}\n`);
process.exit(echecs === 0 ? 0 : 1);
