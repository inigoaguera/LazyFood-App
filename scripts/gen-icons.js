// Genera los iconos PWA (192/512) en public/icons usando sólo Node builtins.
// Diseño: fondo verde "Huerto" + círculo central con tono más claro (silueta aguacate).
//
// Uso:  npm run icons

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { Buffer } from 'node:buffer';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const BG = [0x4a, 0x7c, 0x3a]; // pal.primary
const FG = [0xdc, 0xe8, 0xd0]; // primarySoft
const SEED = [0x1f, 0x2a, 0x1c]; // ink (semilla)

function makePng(size, opts = {}) {
  const { padding = 0 } = opts;
  const w = size, h = size;
  const cx = w / 2, cy = h / 2;
  const r = (w - padding * 2) * 0.34;
  const seedR = r * 0.32;

  // Raw image: rows of (filter byte + RGB triplets)
  const stride = 1 + w * 3;
  const buf = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    buf[y * stride] = 0; // filter: None
    for (let x = 0; x < w; x++) {
      const dx = x - cx, dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      let c = BG;
      if (d <= r) c = FG;
      if (d <= seedR) c = SEED;
      const i = y * stride + 1 + x * 3;
      buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2];
    }
  }

  return encodePng(w, h, buf);
}

function encodePng(w, h, raw) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // color type RGB
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace
  const idat = deflateSync(raw);
  const iend = Buffer.alloc(0);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', iend)]);
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

writeFileSync(resolve(outDir, 'icon-192.png'), makePng(192));
writeFileSync(resolve(outDir, 'icon-512.png'), makePng(512));
writeFileSync(resolve(outDir, 'icon-maskable.png'), makePng(512, { padding: 64 }));
console.log('Iconos generados en', outDir);
