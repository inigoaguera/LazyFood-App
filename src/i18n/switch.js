// Cambio de idioma y su sincronización con la cuenta. Va aparte de index.js
// porque toca la base local y la API, y el núcleo de i18n tiene que poder
// importarse desde cualquier sitio sin arrastrar esas dependencias.
//
// Modelo:
//   - settings.lang        → elección EXPLÍCITA en este móvil. Sólo la escribe
//                            changeLang (selector del login o de Perfil). Es lo
//                            único que se sube a una cuenta sin idioma.
//   - settings.langPending → { lang, at }: idioma elegido con sesión que el
//                            servidor aún no ha confirmado, con la hora de la
//                            elección. Manda sobre prefs (App.jsx), así que el
//                            cambio se ve al instante, también sin conexión.
//   - me.prefs.lang/langAt → lo que dice el servidor. La copia local de `me`
//                            sólo la escribe fetchMe. El Worker descarta un
//                            lang con langAt más viejo que el guardado.
import { db, getSetting, setSetting } from '../db.js';
import { patchMe } from '../api/session.js';
import { normalizeLang, rememberLangLocally, setLang } from './index.js';

// La marca antes era un string ('en'); se sigue aceptando.
export function readPending(v) {
  if (!v) return null;
  if (typeof v === 'string') return normalizeLang(v) ? { lang: v, at: 0 } : null;
  return normalizeLang(v.lang) ? { lang: v.lang, at: Number(v.at) || 0 } : null;
}

export async function changeLang(l) {
  const lang = normalizeLang(l);
  if (!lang) return;
  setLang(lang);
  rememberLangLocally(lang);
  await setSetting('lang', lang);
  const me = await getSetting('me');
  // Sin sesión no hay nada que subir, y una marca vieja de otra sesión
  // taparía esta elección (manda sobre settings.lang).
  await setSetting('langPending', me ? { lang, at: Date.now() } : null);
  if (me) syncLangToAccount();
}

// Marca un idioma para subir a la cuenta (App la usa con la elección explícita
// de este móvil cuando la cuenta aún no tiene idioma).
export async function markLangPending(lang) {
  if (!normalizeLang(lang)) return;
  await setSetting('langPending', { lang, at: Date.now() });
}

// Sube la marca a la cuenta. Las llamadas se encadenan en serie: si cambias de
// idioma dos veces seguidas, el segundo PATCH espera al primero y cada uno lee
// la marca al ejecutarse, así que siempre gana el último. La marca sólo se
// quita si el servidor la tiene, o si tiene una elección más reciente (hecha en
// otro móvil, que gana). Si falla (sin conexión) se queda y App vuelve a
// llamar con el siguiente /me. Es seguro llamarla de más: sin marca no hace nada.
let chain = Promise.resolve();
export function syncLangToAccount() {
  chain = chain.then(async () => {
    const want = readPending(await getSetting('langPending'));
    if (!want) return;
    const [me, jwt] = [await getSetting('me'), await getSetting('jwt')];
    if (!me?.id || !jwt) return;
    const fresh = await patchMe({ prefs: { lang: want.lang, langAt: want.at } });
    const serverLang = fresh?.prefs?.lang;
    const serverAt = Number(fresh?.prefs?.langAt) || 0;
    const settled = serverLang === want.lang || serverAt > want.at;
    const now = readPending(await getSetting('langPending'));
    if (settled && now && now.lang === want.lang && now.at === want.at) {
      await setSetting('langPending', null);
    }
  }).catch(() => { /* sin conexión: se reintenta con el siguiente /me */ });
  return chain;
}

// Al cerrar sesión (o caducar el JWT): la marca pertenece a esa cuenta y no
// debe subirse a la siguiente. NO se toca settings.lang: guardar ahí el idioma
// en uso lo convertiría en "elección explícita" y se subiría a la próxima
// cuenta sin idioma. El login sale en el último idioma mostrado (localStorage).
export async function resetLangOnLogout() {
  await setSetting('langPending', null);
}

// Las sugerencias del hub y el historial del chat de antojos son texto que ya
// generó la IA en un idioma. App llama a esto cada vez que cambia el idioma
// EFECTIVO (lo cambies aquí, desde otro móvil o al entrar en otra cuenta): si
// difiere del de las cachés, se tiran, para todas las casas. Las recetas
// guardadas no se tocan. Las cachés anteriores a esta función eran castellano.
// En serie, para que dos cambios seguidos no dejen aiCacheLang desfasado.
let cacheChain = Promise.resolve();
export function onEffectiveLangChange(lang) {
  cacheChain = cacheChain.then(async () => {
    const prev = (await getSetting('aiCacheLang')) || 'es';
    if (prev === lang) return;
    for (const prefix of ['aiRecipes:', 'antojos:']) {
      await db.settings.where('key').startsWith(prefix).delete();
    }
    await setSetting('aiCacheLang', lang);
  }).catch(() => {});
  return cacheChain;
}
