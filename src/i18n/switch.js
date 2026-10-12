// Cambio de idioma. Va aparte de index.js porque toca la base local y la API,
// y el núcleo de i18n tiene que poder importarse desde cualquier sitio sin
// arrastrar esas dependencias.
import { db, getSetting, setSetting } from '../db.js';
import { patchMe } from '../api/session.js';
import { normalizeLang, rememberLangLocally, setLang } from './index.js';

// Las sugerencias del hub y el historial del chat de antojos son texto que ya
// generó la IA en el idioma anterior. Se tiran para todas las casas: el idioma
// es del usuario, no de la casa. Las recetas GUARDADAS no se tocan.
async function clearAiCaches() {
  for (const prefix of ['aiRecipes:', 'antojos:']) {
    await db.settings.where('key').startsWith(prefix).delete();
  }
}

// Con sesión, el idioma va en `prefs` (como la paleta) para que te siga a otro
// móvil. Se escribe primero en la copia local de `me` para que la app cambie
// al instante, también sin conexión; el PATCH confirma después.
export async function changeLang(l) {
  const lang = normalizeLang(l);
  if (!lang) return;
  setLang(lang);
  rememberLangLocally(lang);
  await setSetting('lang', lang);
  await clearAiCaches();

  const me = await getSetting('me');
  if (!me) return;
  const prefs = { ...(me.prefs || {}), lang };
  await setSetting('me', { ...me, prefs });
  await patchMe({ prefs });
}
