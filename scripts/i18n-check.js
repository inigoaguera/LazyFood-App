// Comprueba la traducción.
//
//   node scripts/i18n-check.js                 → informe completo
//   node scripts/i18n-check.js src/screens/Home.jsx src/screens/Inventory.jsx
//                                              → sólo literales de esos ficheros
//   node scripts/i18n-check.js --strict        → sale con error también si quedan literales
//
// 1. CLAVES: es/ y en/ deben tener exactamente las mismas (incluidos plurales).
//    Una clave sólo en un idioma es un error y hace fallar el script.
// 2. CLAVES USADAS: cada t('ns.clave') / tNodes('ns.clave') con clave literal
//    debe existir en es/. (Las claves dinámicas `domain.cat.${id}` no se miran.)
// 3. LITERALES: texto que parece castellano visible fuera de src/i18n. Es una
//    heurística (tildes, ñ, ¿¡, texto JSX entre etiquetas, frases entre
//    comillas): puede dar algún falso positivo. Para silenciar una línea
//    concreta a propósito, añade el comentario `// i18n-ignore` en esa línea.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src');
const args = process.argv.slice(2);
const strict = args.includes('--strict');
const only = args.filter((a) => !a.startsWith('--')).map((a) => path.resolve(root, a));

// Ficheros que no se traducen a propósito (herramientas de depuración).
const SKIP_LITERALS = new Set([
  'src/screens/DebugOverlay.jsx', 'src/util/debug.js', 'src/util/jwt.js',
  // Castellano a propósito: prompts de la IA (afinados en castellano; el idioma
  // de salida lo fija ai.directive) y datos de prueba en castellano.
  'src/api.js', 'src/aiSchemas.js', 'src/data/seed.es.js', 'src/data/seed.en.js',
]);

const es = (await import(pathToFileURL(path.join(src, 'i18n/es/index.js')))).default;
const en = (await import(pathToFileURL(path.join(src, 'i18n/en/index.js')))).default;

function flatten(obj, prefix = '', out = new Map()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') flatten(v, key, out);
    else out.set(key, v);
  }
  return out;
}
const esKeys = flatten(es);
const enKeys = flatten(en);

let errors = 0;
const onlyIn = (a, b) => [...a.keys()].filter((k) => !b.has(k));
const missingEn = onlyIn(esKeys, enKeys);
const missingEs = onlyIn(enKeys, esKeys);
if (missingEn.length) { errors += missingEn.length; console.log(`\n✗ ${missingEn.length} claves en es/ que faltan en en/:`); missingEn.forEach((k) => console.log(`   ${k}`)); }
if (missingEs.length) { errors += missingEs.length; console.log(`\n✗ ${missingEs.length} claves en en/ que faltan en es/:`); missingEs.forEach((k) => console.log(`   ${k}`)); }

// Variables {x} distintas entre idiomas: suele ser una errata. En las formas
// _one/_zero un idioma puede omitir {n} ("the item" en vez de "the 1 item"),
// así que ahí sólo se exige que no aparezcan variables que el otro no tiene.
const varList = (s) => [...new Set([...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();
const vars = (s) => varList(s).join(',');
const looseOk = (a, b) => {
  const la = varList(a).filter((x) => x !== 'n');
  const lb = varList(b).filter((x) => x !== 'n');
  return la.join(',') === lb.join(',');
};
for (const [k, v] of esKeys) {
  if (!enKeys.has(k) || typeof v !== 'string') continue;
  const loose = /_(one|zero)$/.test(k);
  if (loose ? !looseOk(v, enKeys.get(k)) : vars(v) !== vars(enKeys.get(k))) {
    errors++;
    console.log(`✗ variables distintas en "${k}": es {${vars(v)}} · en {${vars(enKeys.get(k))}}`);
  }
}

// ─── Ficheros fuente ────────────────────────────────────────────────────
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'i18n') walk(p, out); }
    else if (/\.(jsx?|tsx?)$/.test(e.name)) out.push(p);
  }
  return out;
}
const files = walk(src);
const rel = (p) => path.relative(root, p).split(path.sep).join('/');

// Quita comentarios conservando saltos de línea y el contenido de los strings.
function stripComments(code) {
  let out = '';
  let i = 0;
  let state = 'code';
  let quote = '';
  while (i < code.length) {
    const c = code[i];
    const n = code[i + 1];
    if (state === 'code') {
      if (c === '/' && n === '/') { state = 'line'; i += 2; continue; }
      if (c === '/' && n === '*') { state = 'block'; i += 2; continue; }
      if (c === '"' || c === "'" || c === '`') { state = 'str'; quote = c; }
      out += c; i++; continue;
    }
    if (state === 'str') {
      if (c === '\\') { out += c + (n ?? ''); i += 2; continue; }
      if (c === quote) state = 'code';
      out += c; i++; continue;
    }
    if (state === 'line') {
      if (c === '\n') { state = 'code'; out += c; }
      i++; continue;
    }
    if (state === 'block') {
      if (c === '*' && n === '/') { state = 'code'; i += 2; continue; }
      if (c === '\n') out += c;
      i++; continue;
    }
  }
  return out;
}

// ─── Claves usadas que no existen ───────────────────────────────────────
const usedMissing = [];
for (const f of files) {
  const code = fs.readFileSync(f, 'utf8');
  for (const m of code.matchAll(/\b(?:t|tNodes|has)\(\s*['"]([\w.]+)['"]/g)) {
    const key = m[1];
    const exists = esKeys.has(key) || esKeys.has(`${key}_other`) || esKeys.has(`${key}_one`)
      || [...esKeys.keys()].some((k) => k.startsWith(`${key}.`));
    if (!exists) usedMissing.push(`${rel(f)}: ${key}`);
  }
}
if (usedMissing.length) {
  errors += usedMissing.length;
  console.log(`\n✗ ${usedMissing.length} claves usadas que no existen en es/:`);
  usedMissing.forEach((s) => console.log(`   ${s}`));
}

// ─── Literales sin traducir ─────────────────────────────────────────────
const SPANISH_CHARS = /[áéíóúñÁÉÍÓÚÑ¿¡]/;
const CSSISH = /px\b|#[0-9a-f]{3}|rgba?\(|calc\(|var\(|cubic|ease|translate|rotate|solid|dashed|monospace|sans-serif|serif|inset|%|\.\d+s\b|\bvw\b|\bvh\b|\bem\b|data:|https?:|\bM\d/i;
const words = (s) => s.split(/\s+/).filter((w) => /^[A-Za-zÁÉÍÓÚÑáéíóúñü¿¡"'(]*[A-Za-zÁÉÍÓÚÑáéíóúñü]{2,}[.,:;!?)"'…]*$/.test(w)).length;

const findings = [];
for (const f of files) {
  const r = rel(f);
  if (SKIP_LITERALS.has(r)) continue;
  if (only.length && !only.includes(path.resolve(f))) continue;
  const raw = fs.readFileSync(f, 'utf8').split('\n');
  const lines = stripComments(raw.join('\n')).split('\n');
  lines.forEach((line, idx) => {
    if (raw[idx].includes('i18n-ignore')) return;
    if (/console\.(log|warn|error|info|debug)\(/.test(line)) return;
    const hits = [];
    // a) Strings entre comillas o backticks que parecen frases.
    for (const m of line.matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)) {
      const s = m[2];
      if (CSSISH.test(s) || /^[\w.-]+$/.test(s)) continue;
      if (/^\.?\.?\//.test(s) || /\.(js|jsx|png|svg|json)$/.test(s)) continue; // imports y rutas
      if (SPANISH_CHARS.test(s) || words(s.replace(/\$\{[^}]*\}/g, ' ')) >= 2) hits.push(s);
    }
    // b) Texto JSX suelto entre etiquetas: >Texto< o > Texto {
    for (const m of line.matchAll(/(?<![=>])>\s*([^<>{}`'"]*[A-Za-zÁÉÍÓÚÑáéíóúñ¿¡][^<>{}`'"]*?)\s*(?=<|\{|$)/g)) {
      const s = m[1].trim();
      if (!s || /&&|\|\||=>|[;=]/.test(s) || CSSISH.test(s)) continue;
      if (/^[a-z]\w*(\.\w+)*$/.test(s)) continue; // identificadores sueltos
      if (/^[A-Z][A-Za-z]+$/.test(s) && /<\/?[A-Z]/.test(line)) continue; // nombres de componente
      hits.push(s);
    }
    // c) Texto JSX en su propia línea o mezclado con {expresiones}: lo que queda
    //    al quitar strings, {…} y <…>. Sólo en .jsx.
    if (f.endsWith('.jsx')) {
      let rest = line.replace(/(['"`])(?:\\.|(?!\1).)*\1/g, ' ');
      for (let k = 0; k < 4; k++) rest = rest.replace(/\{[^{}]*\}/g, ' ');
      rest = rest.replace(/<[^>]*>/g, ' ').replace(/<\/?[\w.]*|\/?>/g, ' ');
      if (!/[=;]|=>|&&|\|\||\?\.|^\s*(return|else|case|default|export|import|const|let|async|await|if|for|while|try|catch|finally)\b/.test(rest)) {
        const text = rest.replace(/[()\[\],:·—–\-+|]/g, ' ').replace(/\s+/g, ' ').trim();
        // Fuera: líneas de estilos/objetos/imports (camelCase, a.b, ternarios, prop:).
        const codey = /[{}]|[a-z][A-Z]|[a-z]\.[a-z]|\?|^\s*[\w$]+\s*:/.test(rest) && !SPANISH_CHARS.test(text);
        // Listas de identificadores (destructuring, deps) y reglas CSS en línea.
        const identList = /^\s*[\w$]+(\s*,\s*[\w$]+)*,?\s*$/.test(line) || /[\w-]+\s*\{[^}]*:[^}]*;\s*\}/.test(line);
        if (!codey && !identList && /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(text) && !hits.some((h) => text.includes(h))
          && (SPANISH_CHARS.test(text) || words(text) >= 2 || /^[A-ZÁÉÍÓÚÑ¿¡][a-záéíóúñ]+[.!?…]?$/.test(text))) {
          hits.push(text);
        }
      }
    }
    if (hits.length) findings.push(`${r}:${idx + 1}: ${hits.map((h) => JSON.stringify(h.slice(0, 70))).join(' · ')}`);
  });
}

console.log(`\nClaves: es ${esKeys.size} · en ${enKeys.size}`);
if (findings.length) {
  console.log(`\n${strict ? '✗' : '⚠'} ${findings.length} líneas con posibles literales sin traducir:`);
  findings.forEach((s) => console.log(`   ${s}`));
} else {
  console.log('✓ Sin literales sospechosos');
}
if (!errors) console.log('✓ Claves coherentes entre es/ y en/');

process.exit(errors || (strict && findings.length) ? 1 : 0);
