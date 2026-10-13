// Graba recorridos reales por la app (screencast CDP) como secuencias de JPEG
// con su marca de tiempo, más los toques, para componerlos luego en el vídeo.
import fs from 'node:fs';
import path from 'node:path';
import { buildStore, installMock, seedSession, HOUSEHOLD_ID, APP_URL } from './mock.mjs';

export const ROOT = path.dirname(new URL(import.meta.url).pathname);
export const WORK = path.join(ROOT, '.work');
export const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

export const VIEW = { width: 390, height: 800 };
const DPR = 2;

export async function launch({ store = buildStore(), prefs, aiDelay } = {}) {
  const browser = await chromium.launch({
    // El formato del <input type=date> sale del idioma del proceso, no del contexto.
    env: { ...process.env, LANG: 'en_GB.UTF-8', LANGUAGE: 'en' },
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-video-capture=${WORK}/receipt.y4m`,
      '--font-render-hinting=none',
      '--lang=en-GB',
    ],
  });
  // El screencast sale siempre a 1 px por px CSS, así que se graba a 780×1600
  // con zoom 2 en <html>: misma maqueta que un móvil de 390×800, el doble de nítida.
  const context = await browser.newContext({
    viewport: { width: VIEW.width * DPR, height: VIEW.height * DPR }, deviceScaleFactor: 1, hasTouch: true,
    locale: 'en-GB', timezoneId: 'Europe/Madrid',
    permissions: ['camera'],
  });
  const mock = await installMock(context, { store, prefs, aiDelay });
  await seedSession(context);
  // Sin cursor de texto parpadeando: el vídeo queda limpio.
  await context.addInitScript((zoom) => {
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style');
      s.textContent = `html{zoom:${zoom}}input,textarea{caret-color:transparent!important}`;
      document.head.appendChild(s);
    });
  }, DPR);
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(APP_URL);
  await page.waitForTimeout(2000);
  // La casa actual sólo vive en IndexedDB: se fija a mano y se recarga.
  await page.evaluate((hid) => new Promise((res, rej) => {
    const r = indexedDB.open('lazyfood');
    r.onsuccess = () => {
      const tx = r.result.transaction('settings', 'readwrite');
      tx.objectStore('settings').put({ key: 'currentHouseholdId', value: hid });
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    };
    r.onerror = () => rej(r.error);
  }), HOUSEHOLD_ID);
  await page.reload();
  await page.waitForTimeout(2500);
  const cdp = await context.newCDPSession(page);
  return { browser, context, page, cdp, mock };
}

// Graba lo que haga `fn` en .work/clips/<name>/ (f00000.jpg… + index.json).
export async function record(env, name, fn) {
  const { page, cdp } = env;
  const dir = path.join(WORK, 'clips', name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const frames = [];
  const taps = [];
  let t0 = null;
  const pending = [];
  const onFrame = ({ data, metadata, sessionId }) => {
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    if (t0 == null) t0 = metadata.timestamp;
    const file = `f${String(frames.length).padStart(5, '0')}.jpg`;
    frames.push({ t: +(metadata.timestamp - t0).toFixed(4), file });
    pending.push(fs.promises.writeFile(path.join(dir, file), Buffer.from(data, 'base64')));
  };
  cdp.on('Page.screencastFrame', onFrame);
  const wall0 = Date.now() / 1000;
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 });
  // Fuerza un primer frame aunque la pantalla esté quieta.
  await page.evaluate(() => new Promise((r) => {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0.01;z-index:99999;pointer-events:none';
    document.body.appendChild(d);
    requestAnimationFrame(() => requestAnimationFrame(() => { d.remove(); r(); }));
  }));
  await page.waitForTimeout(150);
  // Los toques van con el reloj de pared y los frames con el del compositor;
  // los dos arrancan a la vez, así que basta con restar el inicio.
  const h = helpers(page, (x, y) => taps.push({ t: +(Date.now() / 1000 - wall0).toFixed(3), x, y }));
  await fn(h, page);
  await page.waitForTimeout(250);
  const wallDur = Date.now() / 1000 - wall0;
  await cdp.send('Page.stopScreencast');
  cdp.off('Page.screencastFrame', onFrame);
  await Promise.all(pending);
  // Si la pantalla se queda quieta al final no llegan frames: la duración real
  // es la de pared, y el compositor mantiene el último.
  const duration = Math.max(frames.length ? frames[frames.length - 1].t + 0.05 : 0, wallDur - 0.1);
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify({ name, view: VIEW, duration, frames, taps }));
  console.log(`[rec] ${name}: ${frames.length} frames, ${duration.toFixed(2)}s, ${taps.length} toques`);
  return { frames, taps, duration };
}

// Acciones en coordenadas del móvil (390×800); el ratón va en píxeles reales.
function helpers(page, logTap) {
  const tapAt = async (x, y, { hold = 90 } = {}) => {
    logTap(x, y);
    await page.waitForTimeout(140); // el círculo del toque aparece antes del click
    await page.mouse.move(x * DPR, y * DPR);
    await page.mouse.down();
    await page.waitForTimeout(hold);
    await page.mouse.up();
  };
  const center = async (loc) => {
    const l = typeof loc === 'string' ? page.locator(loc).first() : loc;
    await l.scrollIntoViewIfNeeded().catch(() => {});
    const b = await l.boundingBox();
    if (!b) throw new Error('sin boundingBox: ' + loc);
    return [(b.x + b.width / 2) / DPR, (b.y + b.height / 2) / DPR];
  };
  return {
    wait: (ms) => page.waitForTimeout(ms),
    tapAt,
    tap: async (loc, opts) => { const [x, y] = await center(loc); await tapAt(x, y, opts); },
    tapText: async (txt, opts = {}) => {
      const l = page.getByText(txt, { exact: !!opts.exact }).nth(opts.nth || 0);
      const [x, y] = await center(l); await tapAt(x, y, opts);
    },
    // Scroll suave del contenedor desplazable que hay bajo (x, y).
    scroll: async (dy, ms = 1200, at = [195, 420]) => {
      await page.evaluate(async ([dy, ms, at, dpr]) => {
        let el = document.elementFromPoint(at[0] * dpr, at[1] * dpr);
        while (el && !(el.scrollHeight > el.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(el).overflowY))) el = el.parentElement;
        if (!el) return;
        const from = el.scrollTop;
        const to = Math.max(0, Math.min(el.scrollHeight - el.clientHeight, from + dy));
        const e = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
        await new Promise((r) => {
          const s = performance.now();
          const step = (n) => { const k = Math.min(1, (n - s) / ms); el.scrollTop = from + (to - from) * e(k); k < 1 ? requestAnimationFrame(step) : r(); };
          requestAnimationFrame(step);
        });
      }, [dy, ms, at, DPR]);
    },
    type: async (loc, text, delay = 55) => {
      await page.locator(loc).first().focus();
      await page.keyboard.type(text, { delay });
    },
  };
}
