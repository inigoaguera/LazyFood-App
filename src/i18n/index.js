// i18n mínimo de LazyFood: castellano (por defecto) e inglés.
//
// Sin librería a propósito: la app no tiene dependencias de UI y lo que hace
// falta cabe aquí. Los textos viven en `es/<namespace>.js` y `en/<namespace>.js`,
// un fichero por dominio, con las MISMAS claves en los dos idiomas.
//
// Convenciones de claves (las comprueba `node scripts/i18n-check.js`):
//   - 'namespace.grupo.elemento'  → t('profile.section.account')
//   - Variables entre llaves      → 'Hola, {name}'   → t('home.hi', { name })
//   - Plurales con sufijo         → 'items_one' / 'items_other' (y 'items_zero'
//     opcional) y se llama SIN sufijo pasando `n`: t('home.items', { n: 3 }).
//   - Texto con un trozo en negrita/enlace → tNodes('auth.sentTo', { email: <b>…</b> })
//
// `t` es global (lee el idioma activo en el momento de la llamada), así que
// sirve igual en componentes que en utilidades o en los prompts de la IA. Los
// componentes se repintan al cambiar de idioma porque `lang` va en el contexto
// (`useLF()`), y App fija el idioma antes de pintar a los hijos.
import { createElement, Fragment } from 'react';
import es from './es/index.js';
import en from './en/index.js';

export const LANGS = {
  es: { label: 'Español', flag: '🇪🇸', locale: 'es-ES' },
  en: { label: 'English', flag: '🇬🇧', locale: 'en-GB' },
};
export const DEFAULT_LANG = 'es';
const DICTS = { es, en };
const LS_KEY = 'lf_lang';

export const normalizeLang = (l) => (l && LANGS[l] ? l : null);

// Idioma del sistema: inglés si el navegador está en inglés, castellano si no.
export function detectLang() {
  try {
    const nav = (navigator.languages && navigator.languages[0]) || navigator.language || '';
    return nav.toLowerCase().startsWith('en') ? 'en' : DEFAULT_LANG;
  } catch { return DEFAULT_LANG; }
}

// Copia síncrona en localStorage: IndexedDB responde tarde (y en iOS a veces
// se borra), y el primer pintado del login ya tiene que salir en su idioma.
export function storedLang() {
  try { return normalizeLang(window.localStorage.getItem(LS_KEY)); } catch { return null; }
}
export function rememberLangLocally(l) {
  try { window.localStorage.setItem(LS_KEY, l); } catch { /* sin storage: no pasa nada */ }
}

let current = storedLang() || detectLang();

export const getLang = () => current;
export const locale = () => LANGS[current].locale;

export function setLang(l) {
  const next = normalizeLang(l) || DEFAULT_LANG;
  current = next;
  if (typeof document !== 'undefined' && document.documentElement.lang !== next) {
    document.documentElement.lang = next;
  }
  return next;
}

// ─── Lookup ─────────────────────────────────────────────────────────────
function lookup(dict, key) {
  let node = dict;
  for (const part of key.split('.')) {
    if (node == null || typeof node !== 'object') return undefined;
    node = node[part];
  }
  return node;
}

const pluralRules = {};
function pluralCategory(lang, n) {
  if (!pluralRules[lang]) pluralRules[lang] = new Intl.PluralRules(LANGS[lang].locale);
  return pluralRules[lang].select(n);
}

function resolve(lang, key, vars) {
  const dict = DICTS[lang];
  const n = vars?.n;
  if (typeof n === 'number') {
    if (n === 0) {
      const zero = lookup(dict, `${key}_zero`);
      if (typeof zero === 'string') return zero;
    }
    const cat = pluralCategory(lang, n);
    const plural = lookup(dict, `${key}_${cat}`) ?? lookup(dict, `${key}_other`);
    if (typeof plural === 'string') return plural;
  }
  const v = lookup(dict, key);
  return typeof v === 'string' ? v : undefined;
}

const warned = new Set();
function missing(key) {
  if (import.meta.env?.DEV && !warned.has(key)) {
    warned.add(key);
    console.warn(`[i18n] falta la clave "${key}" (${current})`);
  }
}

function interpolate(str, vars) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (m, name) => (vars[name] != null ? String(vars[name]) : m));
}

// Texto traducido. Si la clave falta en el idioma activo cae al castellano, y
// si tampoco está devuelve la propia clave (visible a propósito en desarrollo).
export function t(key, vars) {
  let s = resolve(current, key, vars);
  if (s === undefined && current !== DEFAULT_LANG) s = resolve(DEFAULT_LANG, key, vars);
  if (s === undefined) { missing(key); return key; }
  return interpolate(s, vars);
}

// ¿Existe la clave? Útil para mapas abiertos (p.ej. códigos de error).
export function has(key) {
  return resolve(current, key) !== undefined || resolve(DEFAULT_LANG, key) !== undefined;
}

// Como `t`, pero las variables pueden ser nodos de React. Devuelve un array
// listo para meter como hijos: tNodes('auth.sentTo', { email: <strong>{email}</strong> }).
export function tNodes(key, vars = {}) {
  const raw = t(key, Object.fromEntries(
    Object.entries(vars).map(([k, v]) => [k, typeof v === 'object' && v !== null ? `\u0000${k}\u0000` : v])
  ));
  return raw.split('\u0000').map((part, i) => (
    i % 2 === 1 && vars[part] !== undefined
      ? createElement(Fragment, { key: i }, vars[part])
      : part
  ));
}

// ─── Formatos ───────────────────────────────────────────────────────────
// Fecha con el locale del idioma activo. `date` admite Date, timestamp o
// 'YYYY-MM-DD' (que se lee a mediodía local para no saltar de día por la zona).
export function fmtDate(date, opts) {
  const d = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? new Date(`${date}T12:00:00`)
    : new Date(date);
  return d.toLocaleDateString(locale(), opts);
}
export function fmtDateTime(date, opts) {
  return new Date(date).toLocaleString(locale(), opts);
}

// Días y meses por índice. La semana empieza en lunes en los dos idiomas.
// i = 0 → lunes … 6 → domingo · m = 0 → enero … 11 → diciembre
export const weekdayShort = (i) => t(`common.weekday.short.${i}`);   // L / M · M / T
export const weekdayAbbr = (i) => t(`common.weekday.abbr.${i}`);     // Lun · Mon
export const weekdayLong = (i) => t(`common.weekday.long.${i}`);     // Lunes · Monday
export const monthLong = (m) => t(`common.month.long.${m}`);         // Enero · January
export const monthShort = (m) => t(`common.month.short.${m}`);       // ene · Jan

// ─── Errores ────────────────────────────────────────────────────────────
// Mensaje para un error de la API o de la app. Traduce por `code` (los del
// Worker y los propios: AI_PARSE, NO_HOUSEHOLD_LOCAL…); si el código no está
// en el diccionario usa el mensaje que traiga el error, y si no hay ninguno,
// el genérico. Sustituye al patrón `e?.message || 'Error'`.
export function errMsg(e, fallbackKey = 'errors.generic') {
  const code = e?.code || (e?.message === 'UNAUTHORIZED' ? 'UNAUTHORIZED' : null);
  if (code && has(`errors.code.${code}`)) return t(`errors.code.${code}`);
  if (e?.name === 'TypeError' && /fetch/i.test(e?.message || '')) return t('errors.network');
  return e?.message || t(fallbackKey);
}
