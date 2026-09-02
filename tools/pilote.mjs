// Un pilote Chrome minimal, par CDP, sans dependance.
//
// POURQUOI PAS `--virtual-time-budget` : sous temps virtuel, `createImageBitmap`
// n'avance jamais. Le decodage se fait hors du fil principal, la promesse ne se
// resout pas, et le banc s'arrete sans message -- c'est le piege 31 de la
// passation, reproduit ici a l'identique : la sonde restait sur « en cours ».
//
// On pilote donc en TEMPS REEL, par le protocole de debogage. Node 24 apporte
// un WebSocket natif, donc cela ne coute aucune dependance.
//
// Ce module ne sait faire que quatre choses, et c'est tout ce dont les bancs
// ont besoin : ouvrir une page, evaluer du code dedans, attendre, et
// photographier.

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHEMINS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];

export const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function attendreEndpoint(port, essais = 100) {
  for (let i = 0; i < essais; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) return (await r.json()).webSocketDebuggerUrl;
    } catch { /* pas encore la */ }
    await dormir(120);
  }
  throw new Error('Chrome n\'a pas ouvert son point de debogage');
}

/**
 * Ouvre un navigateur pilotable.
 *
 * @param {object} [o]
 * @param {number} [o.largeur=1280]
 * @param {number} [o.hauteur=720]
 * @param {boolean} [o.gpu=false] laisser faux : le rendu logiciel est plus
 *   reproductible, et de toute facon les temps releves sans tete ne veulent
 *   rien dire (§10.9 de la passation).
 */
export async function ouvrirNavigateur({ largeur = 1280, hauteur = 720, gpu = false } = {}) {
  const exe = CHEMINS.find((p) => existsSync(p));
  if (!exe) throw new Error('aucun navigateur trouve');

  const port = 9222 + Math.floor(Math.random() * 500);
  const profil = mkdtempSync(join(tmpdir(), 'noverre-'));
  const args = [
    '--headless=new', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--mute-audio',
    // SANS TETE, UN CLIC PROGRAMMATIQUE N'EST PAS UN GESTE UTILISATEUR : le
    // contexte audio reste `suspended` et tout le banc du son mesure -200 dB.
    // C'est un artefact d'environnement, pas un defaut du site -- la regle
    // « aucun son sans clic » reste verifiee autrement, en controlant qu'aucun
    // contexte n'EXISTE avant le clic, ce qui est bien le fait de notre code.
    '--autoplay-policy=no-user-gesture-required',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profil}`,
    `--window-size=${largeur},${hauteur}`,
    // Le rendu logiciel doit couvrir WebGL2, sinon le bassin ne se cree pas du
    // tout et l'on croit a un bug de code.
    ...(gpu ? [] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']),
    'about:blank',
  ];
  const proc = spawn(exe, args, { stdio: 'ignore' });

  const url = await attendreEndpoint(port);
  const ws = new WebSocket(url);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let id = 0;
  const attente = new Map();
  const ecouteurs = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && attente.has(m.id)) {
      const { res, rej } = attente.get(m.id);
      attente.delete(m.id);
      m.error ? rej(new Error(m.error.message)) : res(m.result);
    } else if (m.method) {
      for (const f of ecouteurs) f(m);
    }
  };

  const envoyer = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const n = ++id;
    attente.set(n, { res, rej });
    ws.send(JSON.stringify({ id: n, method, params, ...(sessionId ? { sessionId } : {}) }));
  });

  const { targetId } = await envoyer('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await envoyer('Target.attachToTarget', { targetId, flatten: true });
  const cmd = (m, p) => envoyer(m, p, sessionId);

  await cmd('Page.enable');
  await cmd('Runtime.enable');
  await cmd('Log.enable');
  await cmd('Network.enable');

  // Tout ce que la page dit, on le garde : une erreur de module ne se voit
  // nulle part ailleurs et ferait chercher le defaut au mauvais endroit.
  const journal = [];
  ecouteurs.push((m) => {
    if (m.sessionId !== sessionId) return;
    if (m.method === 'Runtime.consoleAPICalled') {
      journal.push({ type: m.params.type,
                     texte: m.params.args.map((a) => a.value ?? a.description ?? '').join(' ') });
    } else if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      journal.push({ type: 'exception',
                     texte: d.exception?.description || d.text });
    } else if (m.method === 'Network.responseReceived'
               && m.params.response.status >= 400) {
      // On nomme l'URL. « Failed to load resource » sans l'URL fait chercher
      // le defaut partout sauf la ou il est.
      journal.push({ type: 'reseau',
                     texte: `${m.params.response.status} ${m.params.response.url}` });
    }
  });

  return {
    journal,
    async aller(url, { attendre = 'load' } = {}) {
      const fini = new Promise((res) => {
        const f = (m) => {
          if (m.sessionId === sessionId && m.method === 'Page.loadEventFired') {
            ecouteurs.splice(ecouteurs.indexOf(f), 1); res();
          }
        };
        ecouteurs.push(f);
      });
      await cmd('Page.navigate', { url });
      if (attendre === 'load') await fini;
    },
    /**
     * Pose un script qui s'executera AVANT tout document de la page.
     *
     * Indispensable pour mesurer le chargement : une sonde installee apres la
     * navigation arrive trop tard, le LCP est deja passe et l'on mesure zero.
     */
    async avantChaqueDocument(source) {
      await cmd('Page.addScriptToEvaluateOnNewDocument', { source });
    },
    /**
     * Emule un appareil : taille de fenetre, rapport de pixels et tactile.
     *
     * Indispensable pour juger la mise en page d'un telephone : la largeur
     * seule ne suffit pas, c'est `mobile: true` qui fait basculer les media
     * queries `(pointer: coarse)` et la gestion du viewport.
     */
    async emulerAppareil({ largeur, hauteur, dpr = 3, mobile = true }) {
      await cmd('Emulation.setDeviceMetricsOverride', {
        width: largeur, height: hauteur, deviceScaleFactor: dpr, mobile,
      });
      await cmd('Emulation.setTouchEmulationEnabled', { enabled: mobile });
    },
    /** Force une preference de media, par exemple le mouvement reduit. */
    async emulerMedia(features) {
      await cmd('Emulation.setEmulatedMedia', { features });
    },
    /** Bride le reseau. Les valeurs sont en octets par seconde. */
    async brider(conditions) {
      await cmd('Network.emulateNetworkConditions', conditions);
    },
    async evaluer(expression) {
      const r = await cmd('Runtime.evaluate', {
        expression, awaitPromise: true, returnByValue: true,
      });
      if (r.exceptionDetails) {
        throw new Error(r.exceptionDetails.exception?.description
                        || r.exceptionDetails.text);
      }
      return r.result.value;
    },
    /**
     * Luminance moyenne et ecart-type d'une zone de la page.
     *
     * On passe par une capture du NAVIGATEUR et non par un `drawImage` dans la
     * page : sur le canvas WebGL, `drawImage` rend du noir faute de
     * `preserveDrawingBuffer`, et l'on conclurait a tort que le bassin ne peint
     * rien. La capture du navigateur, elle, composite correctement -- verifie.
     */
    async mesurerZone(clip) {
      const { data } = await cmd('Page.captureScreenshot', {
        format: 'png', clip: { ...clip, scale: 0.125 },
      });
      // On renvoie la capture DANS la page pour la mesurer : le navigateur sait
      // decoder une image, Node ne le sait pas sans dependance, et l'on ne va
      // pas ajouter une dependance pour une moyenne de pixels.
      const r = await cmd('Runtime.evaluate', {
        expression: `(async () => {
          const im = new Image();
          im.src = 'data:image/png;base64,${data}';
          await im.decode();
          const c = document.createElement('canvas');
          c.width = im.width; c.height = im.height;
          const x = c.getContext('2d');
          x.drawImage(im, 0, 0);
          const d = x.getImageData(0, 0, c.width, c.height).data;
          let s = 0, s2 = 0; const n = d.length / 4;
          for (let i = 0; i < d.length; i += 4) {
            const l = 0.2126*d[i] + 0.7152*d[i+1] + 0.0722*d[i+2];
            s += l; s2 += l*l;
          }
          const m = s / n;
          return { luminance: m, ecart: Math.sqrt(Math.max(s2/n - m*m, 0)),
                   largeur: c.width, hauteur: c.height };
        })()`,
        awaitPromise: true, returnByValue: true,
      }, sessionId);
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
      return r.result.value;
    },
    async photo(chemin) {
      const { data } = await cmd('Page.captureScreenshot', { format: 'png' });
      writeFileSync(chemin, Buffer.from(data, 'base64'));
      return chemin;
    },
    async fermer() {
      try { ws.close(); } catch { /* deja fermee */ }
      proc.kill();
      await dormir(200);
      try { rmSync(profil, { recursive: true, force: true }); } catch { /* tant pis */ }
    },
  };
}
