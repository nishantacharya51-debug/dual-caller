import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { appScript, createBus, installFakes } from './fakes.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const HTML = readFileSync(join(here, '..', 'index.html'), 'utf8');
const SCRIPT = appScript(join(here, '..', 'index.html'));

export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export async function waitFor(fn, { timeout = 4000, label = 'condition', interval = 8 } = {}) {
  const t0 = Date.now();
  let last;
  while (Date.now() - t0 < timeout) {
    try { const v = fn(); last = v; if (v) return v; } catch (e) { last = e; }
    await sleep(interval);
  }
  throw new Error('timeout waiting for ' + label + (last instanceof Error ? ' (' + last.message + ')' : ' (got ' + JSON.stringify(last) + ')'));
}

export async function makeClient({ bus, name = 'A', hash = '', storage = null, ua = null } = {}) {
  const url = 'https://inkocaller.test/' + (hash ? '#' + hash : '');
  const dom = new JSDOM(HTML, {
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    url,
    userAgent: ua || 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
  });
  const win = dom.window;
  if (ua) Object.defineProperty(win.navigator, 'userAgent', { configurable: true, value: ua });
  if (!process.env.INKO_TEST_LOG) {
    const quiet = () => {};
    win.console = { log: quiet, info: quiet, warn: quiet, error: quiet, debug: quiet };
  }
  installFakes(win, bus, name);
  // Runtime-only test fixtures; never shipped in the site HTML.
  win.INKO_DISABLE_TURN_CREDENTIALS = true;
  win.INKO_TURN_SERVERS = [
    { name: 'ExpressTURN 1', urls: ['turn:relay1.expressturn.com:3478'], username: 'test-user', credential: 'test-password' },
    { name: 'ExpressTURN 2', urls: ['turn:relay2.expressturn.com:3478'], username: 'test-user', credential: 'test-password' },
    { name: 'ExpressTURN 3', urls: ['turn:relay3.expressturn.com:3478'], username: 'test-user', credential: 'test-password' },
    { name: 'OpenRelay 80', urls: ['turn:openrelay.metered.ca:80'], username: 'test-user', credential: 'test-password' },
    { name: 'OpenRelay 443', urls: ['turn:openrelay.metered.ca:443'], username: 'test-user', credential: 'test-password' },
    { name: 'FreeSTUN', urls: ['turn:freestun.net:3478'], username: 'test-user', credential: 'test-password' },
  ];
  if (storage) Object.keys(storage).forEach(k => win.localStorage.setItem(k, typeof storage[k] === 'string' ? storage[k] : JSON.stringify(storage[k])));
  win.eval(SCRIPT);
  await sleep(20);
  const doc = win.document;
  const client = {
    name, win, dom, doc, bus,
    $: (id) => doc.getElementById(id),
    q: (sel) => doc.querySelector(sel),
    qa: (sel) => Array.from(doc.querySelectorAll(sel)),
    click: async (idOrEl) => {
      const el = typeof idOrEl === 'string' ? doc.getElementById(idOrEl) : idOrEl;
      if (!el) throw new Error('no element to click: ' + idOrEl);
      el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
      await sleep(100);
      return el;
    },
    type: (id, value) => { const el = doc.getElementById(id); el.value = value; el.dispatchEvent(new win.Event('input', { bubbles: true })); return el; },
    key: (id, k) => { const el = doc.getElementById(id); el.dispatchEvent(new win.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); },
    text: (id) => (doc.getElementById(id) || {}).textContent || '',
    html: (id) => (doc.getElementById(id) || {}).innerHTML || '',
    visible: (id) => { const el = doc.getElementById(id); return !!el && !el.classList.contains('hidden'); },
    state: () => win.inko.S,
    close: () => {
      try { const s = win.inko && win.inko.S; if (s) { if (s.timer) clearInterval(s.timer); if (s.statsTimer) clearInterval(s.statsTimer); if (s.escTimer) clearTimeout(s.escTimer); if (s.reconTimer) clearTimeout(s.reconTimer); if (s.guestTimer) clearTimeout(s.guestTimer); } if (win.inko && win.inko.Chat && win.inko.Chat.retryT) clearInterval(win.inko.Chat.retryT); } catch (e) {}
      try { win.close(); } catch (e) {}
    },
  };
  ALL.add(client);
  return client;
}

export { createBus };

/* shared scenario helpers */
export async function hostReady(bus, { name = 'A', roomId } = {}) {
  const A = await makeClient({ bus, name });
  if (roomId) A.win.inko.startRoom(roomId); else await A.click('startBtn');
  await waitFor(() => A.state().sigOk && A.state().roomId, { label: 'host signaling ready', timeout: 8000 });
  return A;
}
export async function connectPair(bus, opts = {}) {
  const A = await hostReady(bus, { roomId: opts.roomId });
  const roomId = A.state().roomId;
  await A.click('joinVideoBtn');
  const B = await makeClient({ bus, name: opts.nameB || 'B', hash: roomId });
  await waitFor(() => B.state().mediaReady, { label: 'B media ready', timeout: 8000 });
  await B.click('joinVideoBtn');
  await waitFor(() => A.state().mediaOk && B.state().mediaOk, { label: 'both media connected', timeout: 12000 });
  await waitFor(() => A.state().dataOpen && B.state().dataOpen, { label: 'both chat channels open', timeout: 8000 });
  return { A, B, roomId };
}
export const close = (...c) => c.forEach(x => x && x.close());
const ALL = new Set();
export function closeAll() { ALL.forEach(c => { try { c.close(); } catch (e) {} }); ALL.clear(); }
process.on('exit', closeAll);
