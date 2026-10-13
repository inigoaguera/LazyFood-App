// Compone el vídeo: pinta stage.html fotograma a fotograma (el tiempo lo pone
// este script, no el reloj) y se los pasa a ffmpeg. Sin audio.
//   node scripts/showcase/render.mjs                         → docs/showcase/lazyfood-showcase.mp4
//   node scripts/showcase/render.mjs --out x.mp4 --fps 30
//   node scripts/showcase/render.mjs --preview 3.5 12 20.25  → .work/preview_<t>.png
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const WORK = path.join(ROOT, '.work');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const preview = args.includes('--preview') ? args.slice(args.indexOf('--preview') + 1).map(Number) : null;
const out = path.resolve(opt('--out', path.join(ROOT, '../../docs/showcase/lazyfood-showcase.mp4')));
const fps = Number(opt('--fps', 60));

// Índice de lo grabado por record.mjs.
const manifest = { clips: {}, stills: {} };
for (const name of fs.readdirSync(path.join(WORK, 'clips'))) {
  const d = JSON.parse(fs.readFileSync(path.join(WORK, 'clips', name, 'index.json'), 'utf8'));
  d.frames.forEach((f) => { f.file = `.work/clips/${name}/${f.file}`; });
  manifest.clips[name] = { duration: d.duration, frames: d.frames, taps: d.taps };
}
for (const f of fs.readdirSync(path.join(WORK, 'stills'))) manifest.stills[f.replace(/\.\w+$/, '')] = `.work/stills/${f}`;

// Servidor estático: con file:// el canvas queda "contaminado" y no se puede
// leer el color de los fotogramas.
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ args: ['--font-render-hinting=none'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.addInitScript((m) => { window.MANIFEST = m; }, manifest);
await page.goto(`${base}/stage.html`);
await page.evaluate(() => window.ready);
const cdp = await page.context().newCDPSession(page);
const shot = async (format) => Buffer.from((await cdp.send('Page.captureScreenshot', { format, quality: format === 'jpeg' ? 95 : undefined, optimizeForSpeed: true })).data, 'base64');

if (preview) {
  for (const t of preview) {
    await page.evaluate((t) => window.renderAt(t), t);
    fs.writeFileSync(path.join(WORK, `preview_${t}.png`), await shot('png'));
  }
  console.log(`[render] ${preview.length} capturas en ${WORK}`);
} else {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const n = Math.round((await page.evaluate(() => window.DURATION)) * fps);
  const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart', '-an', out],
  { stdio: ['pipe', 'inherit', 'inherit'] });
  const start = Date.now();
  for (let i = 0; i < n; i++) {
    await page.evaluate((t) => window.renderAt(t), i / fps);
    if (!ff.stdin.write(await shot('jpeg'))) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % (fps * 5) === 0) console.log(`[render] ${i}/${n} fotogramas · ${((Date.now() - start) / 1000).toFixed(0)} s`);
  }
  ff.stdin.end();
  const code = await new Promise((r) => ff.on('close', r));
  if (code !== 0) throw new Error(`ffmpeg terminó con código ${code}`);
  console.log(`[render] ${out} (${n} fotogramas, ${((Date.now() - start) / 1000).toFixed(0)} s)`);
}
await browser.close();
server.close();
