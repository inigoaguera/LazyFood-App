// Cambio de idioma y su sincronización con la cuenta. Va aparte de index.js
// porque toca la base local y la API, y el núcleo de i18n tiene que poder
// importarse desde cualquier sitio sin arrastrar esas dependencias.
//
// Modelo:
//   - settings.lang        → elección EXPLÍCITA en este móvil (la escribe
//                            changeLang, y el logout con el idioma en uso). Es
//                            lo que se sube a una cuenta que aún no tiene idioma.
//   - settings.langPending → idioma elegido con sesión que el servidor aún no
//                            ha confirmado. Manda sobre prefs (App.jsx), así que
//                            el cambio se ve al instante, también sin conexión.
//   - me.prefs.lang        → lo que dice el servidor. La copia local de `me`
//                            sólo la escribe fetchMe.
import { db, getSetting, setSetting } from '../db.js';
import { patchMe } from '../api/session.js';
import { normalizeLang, rememberLangLocally, setLang } from './index.js';

export async function changeLang(l) {
  const lang = normalizeLang(l);
  if (!lang) return;
  setLang(lang);
  rememberLangLocally(lang);
  await setSetting('lang', lang);
  const me = await getSetting('me');
  // Sin sesión no hay nada que subir, y una marca vieja de otra sesión
  // taparía esta elección (manda sobre settings.lang).
  await setSetting('langPending', me ? lang : null);
  if (me) syncLangToAccount();
}

// Sube langPending a la cuenta. Las llamadas se encadenan en serie: si cambias
// de idioma dos veces seguidas, el segundo PATCH espera al primero y cada uno
// lee la marca en el momento de ejecutarse, así que siempre gana el último y
// ningún PATCH viejo llega después de uno nuevo. Es seguro llamarla de más:
// sin marca no hace nada. Si falla (sin conexión) la marca se queda y App la
// vuelve a llamar con el siguiente /me.
let chain = Promise.resolve();
export function syncLangToAccount() {
  chain = chain.then(async () => {
    const want = normalizeLang(await getSetting('langPending'));
    if (!want) return;
    const me = await getSetting('me');
    if (!me?.id) return;
    // Sólo {lang}: el Worker fusiona prefs, así que no se pisan paleta ni
    // tipografía cambiadas desde otro móvil.
    if (me.prefs?.lang !== want) await patchMe({ prefs: { lang: want } });
    if (normalizeLang(await getSetting('langPending')) === want) await setSetting('langPending', null);
  }).catch(() => { /* sin conexión: se reintenta con el siguiente /me */ });
  return chain;
}

// Al cerrar sesión (o caducar el JWT): la marca pertenece a esa cuenta y no
// debe subirse a la siguiente. Se guarda como elección local el idioma que se
// estaba usando, para que el login salga en ese mismo idioma.
export async function resetLangOnLogout(lang) {
  await setSetting('langPending', null);
  if (normalizeLang(lang)) await setSetting('lang', lang);
}

// Las sugerencias del hub y el historial del chat de antojos son texto que ya
// generó la IA en un idioma. App llama a esto cada vez que cambia el idioma
// EFECTIVO (lo cambies aquí, desde otro móvil o al entrar en otra cuenta): si
// difiere del de las cachés, se tiran, para todas las casas. Las recetas
// guardadas no se tocan. Las cachés anteriores a esta función eran castellano.
export async function onEffectiveLangChange(lang) {
  const prev = (await getSetting('aiCacheLang')) || 'es';
  if (prev === lang) return;
  for (const prefix of ['aiRecipes:', 'antojos:']) {
    await db.settings.where('key').startsWith(prefix).delete();
  }
  await setSetting('aiCacheLang', lang);
}
