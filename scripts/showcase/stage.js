// Compositor del showcase: todo es función del tiempo t (segundos), así que
// render.mjs puede pintar cualquier fotograma de forma determinista.
const M = window.MANIFEST; // lo inyecta render.mjs: { clips: {nombre: índice}, stills: {nombre: archivo} }
const C = {
  bg: '#F5F1E8', surface: '#FFFCF4', ink: '#1F2A1C', inkSoft: '#5C6B55', primary: '#4A7C3A',
  primarySoft: '#DCE8D0', accent: '#E8A838', accentSoft: '#F9E6BF', danger: '#C6513A', dangerSoft: '#F5D8CF',
  cool: '#7FB0C4', coolSoft: '#D9E9EF', fridge: '#C5DEC0', pantry: '#E8CFA3',
};

// ─── Utilidades ──────────────────────────────────────────────────────
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const E = {
  lin: (x) => x,
  outCubic: (x) => 1 - Math.pow(1 - x, 3),
  inCubic: (x) => x * x * x,
  inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  outExpo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  outQuint: (x) => 1 - Math.pow(1 - x, 5),
  inQuint: (x) => x * x * x * x * x,
  inOutQuint: (x) => (x < 0.5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2),
  outBack: (x) => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  outBackBig: (x) => { const c1 = 2.2, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
};
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, k) => { const x = hex(a), y = hex(b); return `rgb(${x.map((v, i) => Math.round(lerp(v, y[i], k))).join(',')})`; };
const lum = (h) => { const [r, g, b] = hex(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
const el = (tag, cls, parent, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (parent) parent.appendChild(e); return e; };
const $ = (id) => document.getElementById(id);
const em = (s) => `<span class="em">${s}</span>`;

// ─── Guion ───────────────────────────────────────────────────────────
// side: dónde va el móvil (R/L). El texto va en el lado contrario.
const SC = [
  { id: 'intro', s: 0, e: 3.0, bg: C.bg },
  { id: 'home', s: 3.0, e: 6.4, bg: C.primarySoft, side: 'R', clip: 'home', from: 0.4, rate: 1.0,
    eyebrow: '🏠|Tu casa', title: ['Todo lo que tienes,', '*de un vistazo*'], sub: 'Nevera, congelador y despensa siempre al día.',
    calls: [{ cls: 'danger', html: `${em('⏳')}5 caducan pronto`, dx: 175, dy: -205, at: 0.6 }, { cls: 'green', html: `${em('🌿')}23 alimentos en casa`, dx: 185, dy: 175, at: 0.9 }],
    emos: [{ ch: '🥛', dx: 330, dy: -420, size: 96, rot: -12 }, { ch: '🥚', dx: 430, dy: -20, size: 80, rot: 14 }, { ch: '🧀', dx: 340, dy: 400, size: 92, rot: -8 }] },
  { id: 'inv', s: 6.4, e: 10.6, bg: C.dangerSoft, side: 'L', clip: 'inventory', from: 0.35, rate: 1.45,
    eyebrow: '⏳|Caducidades', title: ['Sabe qué *caduca*', 'antes que tú'], sub: 'Todo ordenado por fecha para que no se tire nada.',
    calls: [{ cls: 'danger', html: `${em('🥬')}Lechuga · en 2 días`, dx: 180, dy: -150, at: 1.0 }, { cls: 'cool', html: `${em('❄️')}Congelado: no corre el reloj`, dx: 190, dy: 230, at: 2.95 }],
    emos: [{ ch: '🍗', dx: 330, dy: -420, size: 90, rot: 10 }, { ch: '🥬', dx: 420, dy: 40, size: 84, rot: -10 }, { ch: '🍦', dx: 320, dy: 410, size: 84, rot: 8 }] },
  { id: 'scan', s: 10.6, e: 17.4, bg: C.accentSoft, side: 'R', clip: 'scan', from: 0.3, rate: 1.27,
    eyebrow: '✨|Escáner con IA', title: ['Escanea el ticket', '*y listo*'], sub: 'La IA reconoce cada producto, su precio y dónde guardarlo.',
    calls: [{ cls: 'dark', html: `${em('✨')}Leyendo con IA…`, dx: 180, dy: -230, at: 1.9, out: 2.85 }, { cls: '', html: `${em('🧾')}<span>10 productos<span class="small">22,85 € · directo a Gastos</span></span>`, dx: 180, dy: -230, at: 3.05 }, { cls: 'green', html: `${em('📦')}Nevera · Despensa · Congelador`, dx: 180, dy: 230, at: 3.5 }],
    emos: [{ ch: '🧾', dx: 330, dy: -430, size: 92, rot: -14 }, { ch: '🛒', dx: 440, dy: 10, size: 86, rot: 8 }, { ch: '🥑', dx: 330, dy: 420, size: 88, rot: -6 }] },
  { id: 'hub', s: 17.4, e: 22.4, bg: '#EFDCBD', side: 'L', clip: 'hub', from: 1.2, rate: 1.45,
    eyebrow: '👩‍🍳|Inspírame', title: ['Recetas con lo', 'que *ya tienes*'], sub: '15 ideas al momento, pensadas para tu nevera.',
    calls: [{ cls: 'accent', html: `${em('✨')}15 ideas en segundos`, dx: 180, dy: -200, at: 1.6 }, { cls: '', html: `${em('😴')}Cero esfuerzo · ${em('👨‍🍳')}Modo chef`, dx: 185, dy: 210, at: 2.3 }],
    emos: [{ ch: '🍳', dx: 330, dy: -420, size: 92, rot: 12 }, { ch: '🍓', dx: 430, dy: 20, size: 80, rot: -10 }, { ch: '🥑', dx: 330, dy: 420, size: 90, rot: 6 }] },
  { id: 'detail', s: 22.4, e: 26.8, bg: '#F6EEDD', side: 'R', clip: 'detail', from: 1.0, rate: 1.55,
    eyebrow: '🍝|Tus recetas', title: ['Raciones que', 'se *ajustan solas*'], sub: 'Cambia los comensales y la IA recalcula las cantidades.',
    calls: [{ cls: 'green', html: `${em('👥')}4 → 6 raciones`, dx: 185, dy: -200, at: 1.4 }, { cls: 'accent', html: `${em('✨')}Cantidades recalculadas`, dx: 185, dy: 200, at: 3.55 }],
    emos: [{ ch: '🍝', dx: 330, dy: -420, size: 96, rot: -8 }, { ch: '🍅', dx: 430, dy: 0, size: 80, rot: 12 }, { ch: '🧄', dx: 330, dy: 420, size: 80, rot: -12 }] },
  { id: 'chat', s: 26.8, e: 32.8, bg: C.coolSoft, side: 'L', clip: 'chat', from: 1.0, rate: 1.45,
    eyebrow: '💬|¿Antojos?', title: ['Pide lo que', 'te *apetezca*'], sub: 'Un chat que te propone recetas con lo que hay en casa.',
    calls: [{ cls: 'bubble', html: '«Algo calentito y rápido para cenar»', dx: 180, dy: -230, at: 1.5, out: 3.45 }, { cls: 'green', html: `${em('🍲')}3 recetas con tu despensa`, dx: 180, dy: -230, at: 3.65 }],
    emos: [{ ch: '🍲', dx: 330, dy: -420, size: 92, rot: 10 }, { ch: '🌶️', dx: 430, dy: 30, size: 80, rot: -14 }, { ch: '🍜', dx: 330, dy: 420, size: 88, rot: 6 }] },
  { id: 'menu', s: 32.8, e: 36.8, bg: C.primarySoft, side: 'R', clip: 'menu', from: 0.9, rate: 1.3,
    eyebrow: '📅|Menú semanal', title: ['Tu semana,', 'en *un toque*'], sub: 'Comidas y cenas planificadas con tus propias recetas.',
    calls: [{ cls: 'green', html: `${em('✅')}14 comidas planificadas`, dx: 185, dy: -200, at: 1.4 }],
    emos: [{ ch: '🥗', dx: 330, dy: -420, size: 92, rot: -10 }, { ch: '🐟', dx: 430, dy: 20, size: 82, rot: 10 }, { ch: '🌮', dx: 330, dy: 420, size: 86, rot: -6 }] },
  { id: 'split', s: 36.8, e: 41.6, bg: C.bg },
  { id: 'themes', s: 41.6, e: 45.4, bg: C.ink },
  { id: 'outro', s: 45.4, e: 49.4, bg: C.primary },
];
const SCI = Object.fromEntries(SC.map((s) => [s.id, s]));
const DURATION = SC[SC.length - 1].e;
window.DURATION = DURATION;

const POS = { R: { x: 1370, y: 540, s: 1, rz: 0, ry: -7 }, L: { x: 550, y: 540, s: 1, rz: 0, ry: 7 } };

// ─── Fondo ───────────────────────────────────────────────────────────
const blobs = [0, 1, 2].map(() => el('div', 'blob', $('blobs')));
(function makeGrain() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'); const d = g.createImageData(256, 256);
  let s = 1234567;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = 0; i < d.data.length; i += 4) { const v = 110 + rnd() * 145; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  g.putImageData(d, 0, 0);
  $('grain').style.backgroundImage = `url(${c.toDataURL()})`;
})();

// Centro del barrido de color al entrar en cada escena.
function wipeCenter(sc) {
  if (sc.side) return [POS[sc.side].x, POS[sc.side].y];
  return [960, 540];
}

function renderBackground(t) {
  let cur = SC[0];
  for (const sc of SC) if (t >= sc.s - 0.25) cur = sc;
  const i = SC.indexOf(cur);
  const prev = SC[Math.max(0, i - 1)];
  const p = i === 0 ? 1 : E.inOutCubic(seg(t, cur.s - 0.25, cur.s + 0.5));
  $('bgBase').style.background = p >= 1 ? cur.bg : prev.bg;
  const [cx, cy] = wipeCenter(cur);
  $('bgWipe').style.background = cur.bg;
  $('bgWipe').style.clipPath = `circle(${(p * 2300).toFixed(1)}px at ${cx}px ${cy}px)`;
  blobs.forEach((b, k) => {
    const x = 960 + Math.sin(t * 0.21 + k * 2.1) * 760 - 550;
    const y = 540 + Math.cos(t * 0.17 + k * 1.7) * 380 - 550;
    b.style.transform = `translate(${x}px, ${y}px) scale(${1 + 0.15 * Math.sin(t * 0.3 + k)})`;
  });
  const dark = t >= SCI.themes.s - 0.1 && t < SCI.outro.s + 0.2;
  $('grain').style.opacity = dark ? 0.1 : 0.07;
  $('grain').style.mixBlendMode = dark ? 'screen' : 'multiply';
}

// ─── Móviles ─────────────────────────────────────────────────────────
const STATUS_ICONS = `
  <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
  <svg width="17" height="12" viewBox="0 0 17 12" fill="currentColor"><path d="M8.5 2.3c2.3 0 4.4.9 6 2.4l1.2-1.2C13.8 1.7 11.3.6 8.5.6S3.2 1.7 1.3 3.5l1.2 1.2c1.6-1.5 3.7-2.4 6-2.4zm0 3.4c1.4 0 2.6.5 3.6 1.4l1.2-1.2C12 4.7 10.3 4 8.5 4S5 4.7 3.7 5.9l1.2 1.2c1-.9 2.2-1.4 3.6-1.4zm0 3.4c.5 0 1 .2 1.3.5L8.5 11 7.2 9.6c.3-.3.8-.5 1.3-.5z"/></svg>
  <svg width="27" height="13" viewBox="0 0 27 13" fill="none"><rect x="0.6" y="0.6" width="22.8" height="11.8" rx="3.6" stroke="currentColor" stroke-opacity=".45" stroke-width="1.2"/><rect x="2.4" y="2.4" width="17.5" height="8.2" rx="2.2" fill="currentColor"/><path d="M25 4.4v4.2c.8-.3 1.4-1.1 1.4-2.1s-.6-1.8-1.4-2.1z" fill="currentColor" fill-opacity=".5"/></svg>`;

function makePhone() {
  const p = el('div', 'phone', $('phones'));
  const bz = el('div', 'bezel', p);
  [[-3, 190, 34], [-3, 250, 64], [-3, 330, 64], [417, 270, 100]].forEach(([x, y, h]) => { const b = el('div', 'btn', p); b.style.left = x + 'px'; b.style.top = y + 'px'; b.style.height = h + 'px'; });
  const sc = el('div', 'screen', p);
  const status = el('div', 'status', sc, `<span>9:41</span><span class="icons">${STATUS_ICONS}</span>`);
  const a = el('img', 'app', sc); const b = el('img', 'app appB', sc);
  el('div', 'island', sc);
  const homebar = el('div', 'homebar', sc);
  const taps = [0, 1].map(() => ({ dot: el('div', 'tap', sc), ring: el('div', 'ring', sc) }));
  el('div', 'glare', sc);
  return { root: p, screen: sc, status, a, b, homebar, taps, srcA: null, srcB: null };
}
const phones = [makePhone(), makePhone(), makePhone()];

function frameAt(clipName, ct) {
  const c = M.clips[clipName];
  const fr = c.frames;
  let lo = 0, hi = fr.length - 1;
  if (ct <= fr[0].t) return fr[0];
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (fr[mid].t <= ct) lo = mid; else hi = mid - 1; }
  return fr[lo];
}
const clipTime = (sc, t) => clamp(sc.from + Math.max(0, t - (sc.s - 0.12)) * sc.rate, 0, M.clips[sc.clip].duration);

// Contenido: { kind: 'clip', clip, ct } o { kind: 'still', name }
function contentInfo(c) {
  if (!c) return null;
  if (c.kind === 'still') return { file: M.stills[c.name], taps: [], ct: 0 };
  return { file: frameAt(c.clip, c.ct).file, taps: M.clips[c.clip].taps, ct: c.ct };
}

// Color de arriba y de abajo de cada fotograma, para pintar a juego la barra de
// estado y el indicador de inicio. Se mide una vez por archivo, ya decodificado.
const colors = new Map();
const probe = document.createElement('canvas');
probe.width = 1; probe.height = 2;
const pctx = probe.getContext('2d', { willReadFrequently: true });
pctx.imageSmoothingQuality = 'high';
const toHex = (d, i) => '#' + [d[i], d[i + 1], d[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('');
function measure(img) {
  const w = img.naturalWidth, h = img.naturalHeight;
  pctx.drawImage(img, 20, 2, 40, 8, 0, 0, 1, 1);
  pctx.drawImage(img, w / 2 - 200, h - 12, 400, 8, 0, 1, 1, 1);
  const d = pctx.getImageData(0, 0, 1, 2).data;
  return { top: toHex(d, 0), bot: toHex(d, 4) };
}

const pending = [];
function setImg(img, file) {
  if (img._f === file) return;
  img._f = file;
  img.src = file;
  pending.push(img.decode().then(() => { if (!colors.has(file)) colors.set(file, measure(img)); }).catch(() => {}));
}

// Coloca el móvil y pide sus imágenes; devuelve lo que hay que pintar cuando
// ya estén decodificadas (colores de la barra y toques).
function renderPhone(ph, st) {
  if (!st || st.opacity <= 0.001) { ph.root.style.display = 'none'; return null; }
  ph.root.style.display = 'block';
  ph.root.style.opacity = st.opacity;
  ph.root.style.transform = `translate(${st.x - 209}px, ${st.y - 436}px) perspective(2200px) rotateY(${st.ry || 0}deg) rotateX(${st.rx || 0}deg) rotateZ(${st.rz || 0}deg) scale(${st.s})`;
  const A = contentInfo(st.a), B = contentInfo(st.b);
  const m = B ? clamp(st.mix) : 0;
  if (A) setImg(ph.a, A.file);
  if (B) setImg(ph.b, B.file);
  ph.a.style.opacity = A ? 1 : 0;
  ph.b.style.opacity = B ? m : 0;
  ph.b.style.transform = B ? `scale(${lerp(1.06, 1, E.outCubic(m))})` : '';
  const dom = m > 0.5 && B ? B : A;
  if (!dom) return null;
  return () => finishPhone(ph, A, B, m, dom);
}

function finishPhone(ph, A, B, m, dom) {
  const ca = A && colors.get(A.file), cb = B && colors.get(B.file), cd = colors.get(dom.file);
  if (cd) {
    ph.status.style.background = ca && cb ? mix(ca.top, cb.top, m) : cd.top;
    ph.status.style.color = lum(cd.top) < 0.5 ? '#fff' : C.ink;
    ph.homebar.style.background = lum(cd.bot) < 0.5 ? 'rgba(255,255,255,0.9)' : 'rgba(31,42,28,0.85)';
  }
  // Toques (sólo del contenido dominante y si es un clip)
  const active = (dom.taps || []).filter((tp) => dom.ct >= tp.t - 0.02 && dom.ct <= tp.t + 0.75);
  ph.taps.forEach((tv, i) => {
    const tp = active[i];
    if (!tp) { tv.dot.style.opacity = 0; tv.ring.style.opacity = 0; return; }
    const life = (dom.ct - tp.t) / 0.75;
    const x = tp.x, y = tp.y + 44;
    const sIn = E.outBack(clamp(life * 5));
    const op = life < 0.1 ? life / 0.1 : 1 - seg(life, 0.45, 0.85);
    tv.dot.style.opacity = op;
    tv.dot.style.transform = `translate(${x}px, ${y}px) scale(${0.55 + 0.45 * sIn - 0.12 * seg(life, 0.22, 0.32) + 0.12 * seg(life, 0.32, 0.45)})`;
    const rl = seg(life, 0.25, 0.85);
    tv.ring.style.opacity = rl > 0 ? 0.9 * (1 - rl) : 0;
    tv.ring.style.transform = `translate(${x}px, ${y}px) scale(${1 + rl * 1.3})`;
  });
}

// Estado del móvil principal en las escenas laterales y sus transiciones.
const SIDE = SC.filter((s) => s.side);
function mainPhone(t) {
  const first = SIDE[0];
  // Entrada desde abajo
  if (t < first.s + 0.65) {
    const p = seg(t, first.s - 0.3, first.s + 0.65);
    if (p <= 0) return null;
    const k = E.outBack(p);
    const P = POS[first.side];
    return { x: P.x, y: lerp(1650, P.y, k), s: lerp(0.85, 1, E.outCubic(p)), rz: lerp(16, 0, E.outCubic(p)), ry: lerp(0, P.ry, p), opacity: 1,
      a: { kind: 'clip', clip: first.clip, ct: clipTime(first, t) } };
  }
  for (let i = 0; i < SIDE.length; i++) {
    const sc = SIDE[i], nx = SIDE[i + 1];
    const P = POS[sc.side];
    const sway = { ry: Math.sin(t * 0.9) * 2.2, rz: Math.sin(t * 0.7 + 1) * 0.7, y: Math.sin(t * 1.1) * 6 };
    if (nx && t >= nx.s - 0.3 && t < nx.s + 0.45) {
      const Q = POS[nx.side];
      const p = E.inOutCubic(seg(t, nx.s - 0.3, nx.s + 0.45));
      const arc = Math.sin(Math.PI * p);
      const dir = Math.sign(Q.x - P.x);
      return {
        x: lerp(P.x, Q.x, p), y: lerp(P.y, Q.y, p) - 40 * arc + sway.y, s: lerp(P.s, Q.s, p) * (1 - 0.12 * arc),
        rz: dir * 7 * arc + sway.rz, ry: lerp(P.ry, Q.ry, p) + sway.ry, opacity: 1,
        a: { kind: 'clip', clip: sc.clip, ct: clipTime(sc, t) },
        b: { kind: 'clip', clip: nx.clip, ct: clipTime(nx, t) },
        mix: E.inOutCubic(seg(t, nx.s - 0.16, nx.s + 0.1)),
      };
    }
    if (t < (nx ? nx.s - 0.3 : sc.e - 0.3) || !nx) {
      if (!nx && t >= sc.e - 0.4) break;
      return { x: P.x, y: P.y + sway.y, s: P.s, rz: sway.rz, ry: P.ry + sway.ry, opacity: 1, a: { kind: 'clip', clip: sc.clip, ct: clipTime(sc, t) } };
    }
  }
  return null;
}

// Escena doble (compra + gastos), tríptico de temas y salida.
const SPLIT = { shopping: { clip: 'shopping', from: 0.9, rate: 1.0 }, expenses: { clip: 'expenses', from: 0.85, rate: 1.05 } };
const ctSplit = (k, t) => clamp(SPLIT[k].from + Math.max(0, t - (SCI.split.s - 0.12)) * SPLIT[k].rate, 0, M.clips[SPLIT[k].clip].duration);
const SPL = [{ x: 735, y: 600, s: 0.84, ry: 6, rz: -1.5 }, { x: 1185, y: 600, s: 0.84, ry: -6, rz: 1.5 }];
const TRI = [{ x: 560, y: 650, s: 0.72, rz: -9, ry: 10 }, { x: 960, y: 620, s: 0.8, rz: 0, ry: 0 }, { x: 1360, y: 650, s: 0.72, rz: 9, ry: -10 }];
const TRI_STILLS = [['home_menta', 'recipes_menta'], ['home_huerto', 'recipes_huerto'], ['home_terracota', 'recipes_terracota']];

function lastSide() { return SIDE[SIDE.length - 1]; }

function phonesState(t) {
  const out = [null, null, null];
  const sp = SCI.split, th = SCI.themes, ou = SCI.outro;
  if (t < sp.s - 0.4) { out[0] = mainPhone(t); return out; }
  const sway = (k) => ({ y: Math.sin(t * 1.1 + k * 1.3) * 6, rz: Math.sin(t * 0.7 + k) * 0.6, ry: Math.sin(t * 0.9 + k) * 1.8 });
  const ls = lastSide();
  const shopC = { kind: 'clip', clip: 'shopping', ct: ctSplit('shopping', t) };
  const expC = { kind: 'clip', clip: 'expenses', ct: ctSplit('expenses', t) };
  if (t < th.s - 0.35) {
    // Menú → doble
    const p = E.inOutCubic(seg(t, sp.s - 0.4, sp.s + 0.4));
    const P = POS[ls.side], Q = SPL[0], w = sway(0);
    const arc = Math.sin(Math.PI * p);
    out[0] = { x: lerp(P.x, Q.x, p), y: lerp(P.y, Q.y, p) - 30 * arc + w.y, s: lerp(1, Q.s, p) * (1 - 0.08 * arc), rz: lerp(0, Q.rz, p) - 6 * arc + w.rz, ry: lerp(P.ry, Q.ry, p) + w.ry, opacity: 1,
      a: { kind: 'clip', clip: ls.clip, ct: clipTime(ls, t) }, b: shopC, mix: E.inOutCubic(seg(t, sp.s - 0.2, sp.s + 0.08)) };
    const p2 = E.outBack(seg(t, sp.s - 0.1, sp.s + 0.6));
    const R = SPL[1], w2 = sway(1);
    if (p2 > 0) out[1] = { x: lerp(2350, R.x, p2), y: R.y + w2.y, s: R.s, rz: lerp(12, R.rz, E.outCubic(seg(t, sp.s - 0.1, sp.s + 0.6))) + w2.rz, ry: R.ry + w2.ry, opacity: 1, a: expC };
    return out;
  }
  if (t < ou.s - 0.2) {
    // Doble → tríptico de temas
    const p = E.inOutCubic(seg(t, th.s - 0.35, th.s + 0.45));
    const swap = E.inOutCubic(seg(t, th.s + 1.7, th.s + 2.0));
    const triContent = (k) => (swap > 0
      ? { a: { kind: 'still', name: TRI_STILLS[k][0] }, b: { kind: 'still', name: TRI_STILLS[k][1] }, mix: swap }
      : { a: { kind: 'still', name: TRI_STILLS[k][0] } });
    [0, 2].forEach((k, j) => {
      const P = SPL[j], Q = TRI[k], w = sway(k);
      const arc = Math.sin(Math.PI * p);
      const from = j === 0 ? shopC : expC;
      const cm = E.inOutCubic(seg(t, th.s - 0.1, th.s + 0.15));
      const tc = triContent(k);
      out[k] = { x: lerp(P.x, Q.x, p), y: lerp(P.y, Q.y, p) + w.y - 20 * arc, s: lerp(P.s, Q.s, p), rz: lerp(P.rz, Q.rz, p) + w.rz, ry: lerp(P.ry, Q.ry, p) + w.ry, opacity: 1,
        ...(cm < 1 ? { a: from, b: tc.a, mix: cm } : tc) };
    });
    const p3 = seg(t, th.s - 0.05, th.s + 0.7);
    if (p3 > 0) {
      const Q = TRI[1], w = sway(1);
      out[1] = { x: Q.x, y: lerp(1500, Q.y, E.outBack(p3)) + w.y, s: Q.s, rz: lerp(-10, 0, E.outCubic(p3)) + w.rz, ry: w.ry, opacity: 1, ...triContent(1) };
    }
    return out;
  }
  // Salida: los tres caen
  const swap = 1;
  [0, 1, 2].forEach((k) => {
    const Q = TRI[k];
    const p = E.inCubic(seg(t, ou.s - 0.2 + k * 0.06, ou.s + 0.45 + k * 0.06));
    if (p >= 1) return;
    out[k] = { x: Q.x + (k - 1) * 200 * p, y: Q.y + 1100 * p, s: Q.s * (1 - 0.15 * p), rz: Q.rz + (k - 1 || 0.5) * 25 * p, ry: Q.ry, opacity: 1,
      a: { kind: 'still', name: TRI_STILLS[k][swap] } };
  });
  return out;
}

// ─── Textos ──────────────────────────────────────────────────────────
function titleHTML(lines) {
  return lines.map((l) => `<span class="line"><span class="in">${l.replace(/\*(.+?)\*/g, '<span class="hl">$1<span class="mk"></span></span>')}</span></span>`).join('');
}
function makeBlock(sc, opts = {}) {
  const b = el('div', 'tblock' + (opts.center ? ' center' : ''), $('front'));
  let eb = null;
  if (sc.eyebrow) { const [e, txt] = sc.eyebrow.split('|'); eb = el('div', 'eyebrow', b, `<span class="em">${e}</span>${txt}`); }
  const ti = el('h1', 'title', b, titleHTML(sc.title));
  if (opts.titleSize) ti.style.fontSize = opts.titleSize + 'px';
  if (opts.color) ti.style.color = opts.color;
  let sub = null;
  if (sc.sub) { sub = el('div', 'sub', b, sc.sub); if (opts.subColor) sub.style.color = opts.subColor; if (opts.center) sub.style.margin = '22px auto 0'; }
  if (!sc.eyebrow) ti.style.marginTop = '0';
  return { b, eb, lines: [...b.querySelectorAll('.line > .in')], marks: [...b.querySelectorAll('.mk')], sub };
}

function animBlock(B, t, tin, tout) {
  const show = t >= tin - 0.05 && t <= tout + 0.4;
  B.b.style.display = show ? 'block' : 'none';
  if (!show) return;
  const outP = (d) => E.inCubic(seg(t, tout + d, tout + d + 0.32));
  if (B.eb) {
    const p = E.outBack(seg(t, tin, tin + 0.45));
    const o = outP(0);
    B.eb.style.opacity = clamp(seg(t, tin, tin + 0.2)) * (1 - o);
    B.eb.style.transform = `translateY(${(1 - p) * 30 - o * 30}px) scale(${0.85 + 0.15 * p})`;
  }
  B.lines.forEach((ln, i) => {
    const p = E.outExpo(seg(t, tin + 0.1 + i * 0.09, tin + 0.85 + i * 0.09));
    const o = outP(0.04 + i * 0.05);
    ln.style.transform = `translateY(${(1 - p) * 112 - o * 112}%)`;
  });
  B.marks.forEach((mk) => {
    const p = E.outCubic(seg(t, tin + 0.6, tin + 1.05));
    mk.style.transform = `scaleX(${p * (1 - outP(0.05))})`;
  });
  if (B.sub) {
    const p = E.outCubic(seg(t, tin + 0.35, tin + 0.9));
    const o = outP(0.12);
    B.sub.style.opacity = p * (1 - o);
    B.sub.style.transform = `translateY(${(1 - p) * 26 - o * 20}px)`;
  }
}

const blocks = [];
for (const sc of SIDE) {
  const B = makeBlock(sc);
  const x = sc.side === 'R' ? 150 : 1010;
  blocks.push({ sc, B, x });
}
const splitBlock = makeBlock({ title: ['Compra y gastos, *bajo control*'] }, { center: true, titleSize: 84 });
const themesBlock = makeBlock({ title: ['Hazla *tuya*'], sub: '3 paletas · 3 tipografías · para toda la casa' }, { center: true, titleSize: 92, color: C.bg, subColor: 'rgba(245,241,232,0.72)' });
themesBlock.b.querySelectorAll('.hl').forEach((h) => { h.style.color = C.accent; h.querySelector('.mk').style.background = C.primary; h.querySelector('.mk').style.opacity = 0.75; });

function placeBlocks() {
  for (const it of blocks) {
    it.B.b.style.display = 'block';
    const h = it.B.b.offsetHeight;
    it.B.b.style.transform = `translate(${it.x}px, ${540 - h / 2 - 10}px)`;
  }
  splitBlock.b.style.width = '1920px';
  splitBlock.b.style.transform = 'translate(0px, 74px)';
  themesBlock.b.style.width = '1920px';
  themesBlock.b.style.transform = 'translate(0px, 70px)';
}

// Tarjetas y emojis alrededor del móvil (lado exterior).
const sideCalls = [];
for (const sc of SIDE) {
  for (const c of sc.calls || []) {
    const e = el('div', 'call ' + c.cls, $('front'), c.html);
    sideCalls.push({ sc, c, e });
  }
}
const sideEmos = [];
for (const sc of SIDE) {
  (sc.emos || []).forEach((m, i) => {
    const e = el('div', 'emo', $('back'), m.ch);
    e.style.fontSize = m.size + 'px';
    sideEmos.push({ sc, m, e, i });
  });
}

function renderSideExtras(t) {
  for (const { sc, c, e } of sideCalls) {
    const tin = sc.s + c.at, tout = c.out != null ? sc.s + c.out : sc.e - 0.32;
    if (t < tin || t > tout + 0.3) { e.style.display = 'none'; continue; }
    e.style.display = 'inline-flex';
    const P = POS[sc.side];
    const p = E.outBack(seg(t, tin, tin + 0.4));
    const o = E.inCubic(seg(t, tout, tout + 0.25));
    const w = e.offsetWidth, h = e.offsetHeight;
    const outer = sc.side === 'R' ? 1 : -1;
    const ax = P.x + outer * c.dx;
    const x = outer > 0 ? Math.min(1890 - w, ax) : Math.max(30, ax - w);
    const y = P.y + c.dy - h / 2 + Math.sin(t * 1.6 + c.dy) * 5;
    e.style.opacity = clamp(p * 1.5) * (1 - o);
    e.style.transform = `translate(${x}px, ${y}px) scale(${(0.6 + 0.4 * p) * (1 - 0.2 * o)}) rotate(${outer * (1 - p) * 6}deg)`;
    e.style.transformOrigin = outer > 0 ? '0% 50%' : '100% 50%';
  }
  for (const { sc, m, e, i } of sideEmos) {
    const tin = sc.s + 0.2 + i * 0.12, tout = sc.e - 0.35 + i * 0.04;
    if (t < tin || t > tout + 0.3) { e.style.display = 'none'; continue; }
    e.style.display = 'block';
    const P = POS[sc.side];
    const outer = sc.side === 'R' ? 1 : -1;
    const p = E.outBackBig(seg(t, tin, tin + 0.5));
    const o = E.inCubic(seg(t, tout, tout + 0.25));
    const x = P.x + outer * m.dx - m.size / 2;
    const y = P.y + m.dy - m.size / 2 + Math.sin(t * 1.4 + i * 2) * 10 - o * 60;
    e.style.opacity = clamp(seg(t, tin, tin + 0.15)) * (1 - o);
    e.style.transform = `translate(${x}px, ${y}px) rotate(${outer * m.rot + Math.sin(t * 1.1 + i) * 5}deg) scale(${p})`;
  }
}

// Etiquetas de la escena doble y del tríptico.
const splitLabels = [
  el('div', 'call', $('front'), `${em('🛒')}Lista de la compra`),
  el('div', 'call', $('front'), `${em('📊')}Gastos del mes`),
];
const triLabels = [['Menta', 'Clean', '#0F9D6E', '#FF8A5C'], ['Huerto', 'Playful', '#4A7C3A', '#E8A838'], ['Terracota', 'Rounded', '#7A8F4E', '#C25A3C']].map(([n, f, c1, c2]) =>
  el('div', 'call', $('front'), `<span style="display:inline-flex;gap:5px"><span style="width:18px;height:18px;border-radius:9px;background:${c1}"></span><span style="width:18px;height:18px;border-radius:9px;background:${c2}"></span></span>${n}<span style="font-weight:500;color:${C.inkSoft}">· ${f}</span>`));
const familyCall = el('div', 'call green', $('front'), `${em('👨‍👩‍👧')}Compartida con toda la casa`);

function popStyle(e, t, tin, tout, x, y, origin = '50% 50%') {
  if (t < tin || t > tout + 0.3) { e.style.display = 'none'; return; }
  e.style.display = 'inline-flex';
  const p = E.outBack(seg(t, tin, tin + 0.4));
  const o = E.inCubic(seg(t, tout, tout + 0.25));
  e.style.transformOrigin = origin;
  e.style.opacity = clamp(p * 1.5) * (1 - o);
  e.style.transform = `translate(${x - e.offsetWidth / 2}px, ${y - e.offsetHeight / 2}px) scale(${(0.6 + 0.4 * p) * (1 - 0.2 * o)})`;
}

function renderSplitThemesExtras(t) {
  const sp = SCI.split, th = SCI.themes;
  animBlock(splitBlock, t, sp.s + 0.15, sp.e - 0.45);
  popStyle(splitLabels[0], t, sp.s + 0.6, sp.e - 0.4, 385, 640);
  popStyle(splitLabels[1], t, sp.s + 0.75, sp.e - 0.4, 1545, 640);
  animBlock(themesBlock, t, th.s + 0.2, th.e - 0.35);
  TRI.forEach((q, k) => popStyle(triLabels[k], t, th.s + 0.75 + [0.1, 0, 0.2][k], th.e - 0.35, q.x, k === 1 ? 990 : 1000));
  popStyle(familyCall, t, th.s + 1.4, th.e - 0.35, 1690, 380);
}

// ─── Intro y cierre ──────────────────────────────────────────────────
function makeLogo() {
  const g = el('div', 'abs', $('front'));
  const icon = el('div', 'icon', g, '<div class="flesh"></div><div class="seed"></div>');
  const word = el('div', 'word', g, 'LazyFood'.split('').map((ch, i) => `<span style="color:${i < 4 ? 'var(--ink)' : 'var(--primary)'}">${ch}</span>`).join(''));
  const tag = el('div', 'tag', g, 'Tu despensa inteligente');
  return { g, icon, word, letters: [...word.querySelectorAll('span')], tag };
}
const intro = makeLogo();
const outro = makeLogo();
outro.icon.style.background = C.bg;
outro.icon.querySelector('.flesh').style.background = C.primary;
outro.letters.forEach((s, i) => { s.style.color = i < 4 ? C.bg : C.accent; });
outro.tag.style.color = 'rgba(245,241,232,0.82)';
const url = el('div', 'url', $('front'), `${em('🥑')}lazyfood.pages.dev`);
url.style.background = C.bg; url.style.color = C.primary;
url.querySelector('.em').style.fontSize = '34px';

const introEmos = [['🍅', 330, 250, 96], ['🥕', 1560, 230, 92], ['🧀', 250, 760, 88], ['🥚', 1640, 790, 84], ['🥦', 640, 140, 76], ['🍋', 1290, 120, 78], ['🍞', 560, 920, 80], ['🍓', 1380, 940, 82], ['🥑', 1780, 520, 90], ['🫒', 120, 500, 74]]
  .map(([ch, x, y, s], i) => { const e = el('div', 'emo', $('back'), ch); e.style.fontSize = s + 'px'; return { e, x, y, s, i }; });
const outroEmos = [['🥑', 300, 240, 100], ['🍅', 1600, 250, 90], ['🥕', 230, 800, 92], ['🧀', 1680, 800, 86], ['🍋', 700, 140, 72], ['🥦', 1240, 130, 76], ['🍞', 560, 950, 74], ['🍓', 1380, 960, 80]]
  .map(([ch, x, y, s], i) => { const e = el('div', 'emo', $('back'), ch); e.style.fontSize = s + 'px'; return { e, x, y, s, i }; });

function layoutLogo(L, cy) {
  // Icono + palabra centrados juntos; lema debajo.
  L.word.style.left = '0px'; L.word.style.top = '0px';
  const ww = L.word.offsetWidth;
  const gap = 46, iw = 200;
  const total = iw + gap + ww;
  const x0 = 960 - total / 2;
  L.icon.style.left = x0 + 'px'; L.icon.style.top = (cy - 100 - 60) + 'px';
  L.word.style.left = (x0 + iw + gap) + 'px'; L.word.style.top = (cy - 88 - 60 - 6) + 'px';
  L.tag.style.left = (960 - L.tag.offsetWidth / 2) + 'px'; L.tag.style.top = (cy + 78) + 'px';
}

function animLogo(L, t, tin, tout, opts = {}) {
  const show = t >= tin - 0.05 && t <= tout + 0.6;
  L.g.style.display = show ? 'block' : 'none';
  if (!show) return;
  const o = E.inCubic(seg(t, tout, tout + 0.45));
  const pi = E.outBackBig(seg(t, tin, tin + 0.65));
  L.icon.style.transform = `translateY(${-o * 80}px) scale(${pi * (1 - 0.3 * o)}) rotate(${(1 - pi) * -25}deg)`;
  L.icon.style.opacity = clamp(seg(t, tin, tin + 0.12)) * (1 - o);
  L.letters.forEach((s, i) => {
    const p = E.outExpo(seg(t, tin + 0.3 + i * 0.045, tin + 0.95 + i * 0.045));
    s.style.transform = `translateY(${(1 - p) * 90 - o * 80}px) rotate(${(1 - p) * 8}deg)`;
    s.style.opacity = clamp(seg(t, tin + 0.3 + i * 0.045, tin + 0.5 + i * 0.045)) * (1 - o);
  });
  const pt = E.outCubic(seg(t, tin + 0.85, tin + 1.35));
  L.tag.style.opacity = pt * (1 - o);
  L.tag.style.transform = `translateY(${(1 - pt) * 24 - o * 60}px)`;
}

function animEmos(list, t, tin, tout, scatter = true) {
  for (const { e, x, y, s, i } of list) {
    const a = tin + i * 0.07;
    if (t < a || t > tout + 0.6) { e.style.display = 'none'; continue; }
    e.style.display = 'block';
    const p = E.outBackBig(seg(t, a, a + 0.55));
    const o = E.inCubic(seg(t, tout + i * 0.02, tout + 0.45 + i * 0.02));
    const dx = (x - 960) * 0.5 * o, dy = (y - 540) * 0.5 * o;
    e.style.opacity = clamp(seg(t, a, a + 0.15)) * (1 - o);
    e.style.transform = `translate(${x - s / 2 + dx}px, ${y - s / 2 + dy + Math.sin(t * 1.5 + i) * 12}px) rotate(${Math.sin(t * 1.2 + i * 1.7) * 10 + (i % 2 ? 8 : -8)}deg) scale(${p})`;
  }
}

function renderIntroOutro(t) {
  const ii = SCI.intro, ou = SCI.outro;
  animLogo(intro, t, 0.15, ii.e - 0.66);
  animEmos(introEmos, t, 0.25, ii.e - 0.7);
  animLogo(outro, t, ou.s + 0.25, 999);
  animEmos(outroEmos, t, ou.s + 0.35, 999);
  const pu = E.outBack(seg(t, ou.s + 1.25, ou.s + 1.7));
  url.style.display = t >= ou.s + 1.2 ? 'inline-flex' : 'none';
  url.style.opacity = clamp(seg(t, ou.s + 1.25, ou.s + 1.4));
  url.style.transform = `translate(${960 - url.offsetWidth / 2}px, ${700 + (1 - pu) * 30}px) scale(${0.7 + 0.3 * pu})`;
}

// ─── Fotograma ───────────────────────────────────────────────────────
let laidOut = false;
window.renderAt = async (t) => {
  if (!laidOut) { placeBlocks(); layoutLogo(intro, 470); layoutLogo(outro, 430); laidOut = true; }
  renderBackground(t);
  const st = phonesState(t);
  const finish = phones.map((ph, k) => renderPhone(ph, st[k]));
  blocks.forEach(({ sc, B }) => animBlock(B, t, sc.s + 0.18, sc.e - 0.42));
  renderSideExtras(t);
  renderSplitThemesExtras(t);
  renderIntroOutro(t);
  await Promise.all(pending.splice(0));
  finish.forEach((f) => f && f());
  // Dos rAF: el compositor ya ha pintado lo que se acaba de poner.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  return true;
};

window.ready = (async () => {
  await document.fonts.load('700 96px Fraunces');
  await document.fonts.load('900 176px Fraunces');
  await document.fonts.load('500 34px "DM Sans"');
  await document.fonts.load('700 25px "DM Sans"');
  await document.fonts.ready;
  return true;
})();
