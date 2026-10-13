// Graba los recorridos por la app y las capturas de las paletas en .work/.
// Necesita la app corriendo contra el backend simulado (ver README.md).
//   node scripts/showcase/record.mjs              → todo
//   node scripts/showcase/record.mjs scan chat    → sólo esos clips
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { launch, record, chromium, ROOT, WORK } from './recorder.mjs';

const only = process.argv.slice(2);
const want = (n) => !only.length || only.includes(n);
fs.mkdirSync(WORK, { recursive: true });

// ─── Cámara simulada: un ticket sobre la mesa, con un leve pulso de mano ───
async function makeReceiptFeed() {
  const dir = path.join(WORK, 'receipt');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 720, height: 1280 } });
  await p.goto('file://' + path.join(ROOT, 'receipt.html'));
  const N = 60;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    await p.evaluate((tf) => { document.getElementById('r').style.transform = tf; },
      `translate(${Math.sin(a) * 6}px,${Math.cos(a * 2) * 4}px) rotate(${-3 + Math.sin(a) * 0.6}deg) scale(${1.02 + Math.sin(a * 2) * 0.006})`);
    await p.screenshot({ path: path.join(dir, `f${String(i).padStart(3, '0')}.png`) });
  }
  await b.close();
  const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', '30', '-i', path.join(dir, 'f%03d.png'), '-pix_fmt', 'yuv420p', path.join(WORK, 'receipt.y4m')], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('ffmpeg no pudo generar receipt.y4m');
}
if (!fs.existsSync(path.join(WORK, 'receipt.y4m'))) await makeReceiptFeed();

// ─── Recorridos ──────────────────────────────────────────────────────
const CLIPS = ['home', 'inventory', 'scan', 'hub', 'detail', 'chat', 'menu', 'shopping', 'expenses'];
if (CLIPS.some(want)) {
  // La IA simulada tarda lo justo para que se vea el estado de "pensando".
  const env = await launch({ aiDelay: { receipt: 1700, hub: 1500, chat: 1500, autoplan: 1200, scale: 1100 } });
  const { page } = env;
  const home = async () => { await page.reload(); await page.waitForTimeout(2200); };
  const nav = (label) => page.getByText(label, { exact: true }).last();
  const navScan = [195, 768];

  // El orden importa: el almacén simulado es uno solo, así que lo escaneado
  // aparece después en recetas, gastos, etc. (como en la vida real).
  if (want('home')) await record(env, 'home', async (h) => {
    await h.wait(700);
    await h.scroll(330, 1700);
    await h.wait(900);
  });

  if (want('inventory')) { await home(); await record(env, 'inventory', async (h) => {
    await h.wait(400);
    await h.tapText('Fridge', { exact: true });
    await h.wait(1300);
    await h.scroll(260, 1300);
    await h.wait(300);
    await h.scroll(-260, 800);
    await h.tap(page.locator('button', { hasText: 'Freezer' }).first());
    await h.wait(1400);
  }); }

  if (want('scan')) { await home(); await record(env, 'scan', async (h) => {
    await h.wait(400);
    await h.tapAt(...navScan);
    await h.wait(1500);
    await h.tapAt(195, 742); // disparador
    await h.wait(2300);
    await h.scroll(520, 1500, [195, 450]);
    await h.wait(400);
    await h.tapText('Add 10 items');
    await h.wait(1600);
  }); }

  if (want('hub')) { await home(); await record(env, 'hub', async (h) => {
    await h.wait(300);
    await h.tap(nav('Recipes'));
    await h.wait(900);
    await h.tapText('Inspire me');
    await h.wait(2300);
    await h.scroll(430, 1500);
    await h.wait(500);
    await h.scroll(520, 1500);
    await h.wait(700);
  }); }

  if (want('detail')) { await home(); await record(env, 'detail', async (h) => {
    await h.tap(nav('Recipes'));
    await h.wait(700);
    await h.tapText("Mum's pasta");
    await h.wait(1200);
    const plus = page.locator('button', { hasText: /^\+$/ }).first();
    await h.tap(plus); await h.wait(350); await h.tap(plus);
    await h.wait(500);
    await h.scroll(330, 1100);
    await h.wait(300);
    await h.tapText('Adjust quantities');
    await h.wait(2000);
  }); }

  if (want('chat')) { await home(); await record(env, 'chat', async (h) => {
    await h.tap(nav('Recipes'));
    await h.wait(700);
    await h.tapText('Cravings?');
    await h.wait(900);
    await h.tap('textarea');
    await h.type('textarea', 'Something warm and quick for dinner', 45);
    await h.wait(300);
    await h.tap(page.locator('textarea').locator('xpath=following::button[1]'));
    await h.wait(2400);
    await h.scroll(420, 1600, [195, 400]);
    await h.wait(700);
  }); }

  if (want('menu')) { await home(); await record(env, 'menu', async (h) => {
    await h.wait(200);
    await h.tapText('Weekly menu');
    await h.wait(1000);
    await h.tapAt(357, 24); // ✨ autoplanificar
    await h.wait(1900);
    await h.scroll(450, 1500);
    await h.wait(600);
  }); }

  if (want('shopping')) { await home(); await record(env, 'shopping', async (h) => {
    await h.wait(200);
    await h.tapText('Shopping list');
    await h.wait(1000);
    // Cada producto marcado baja al carro y el siguiente sube a su sitio.
    for (let i = 0; i < 3; i++) { await h.tapAt(43, 197); await h.wait(i < 2 ? 750 : 1300); }
  }); }

  if (want('expenses')) { await home(); await record(env, 'expenses', async (h) => {
    await h.wait(200);
    await h.tap(nav('Spending'));
    await h.wait(1500);
    await h.tap(page.locator('button', { hasText: 'By shop' }).first());
    await h.wait(1300);
    await h.tapAt(352, 26); // calendario
    await h.wait(1700);
  }); }
  await env.browser.close();
}

// ─── Capturas fijas: la app en las tres paletas y tipografías ──────────
if (want('stills')) {
  const dir = path.join(WORK, 'stills');
  fs.mkdirSync(dir, { recursive: true });
  for (const [palette, font] of [['huerto', 'playful'], ['menta', 'clean'], ['terracota', 'rounded']]) {
    const e = await launch({ prefs: { palette, font, lang: 'en' } });
    await e.page.waitForTimeout(800);
    await e.page.screenshot({ path: path.join(dir, `home_${palette}.jpg`), type: 'jpeg', quality: 92 });
    await e.page.getByText('Recipes', { exact: true }).last().click();
    await e.page.waitForTimeout(600);
    await e.page.getByText('Inspire me').first().click();
    await e.page.waitForTimeout(5200); // que se vaya el aviso de "sugerencias actualizadas"
    await e.page.screenshot({ path: path.join(dir, `recipes_${palette}.jpg`), type: 'jpeg', quality: 92 });
    await e.browser.close();
  }
  console.log('[rec] stills: 6 capturas');
}
