// Cambio de idioma. Va aparte de index.js porque toca la base local y la API,
// y el núcleo de i18n tiene que poder importarse desde cualquier sitio sin
// arrastrar esas dependencias.
import { db, getSetting, setSetting } from '../db.js';
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
// móvil. Aquí sólo se marca `langPending`, que manda sobre prefs (App.jsx) y
// hace que la app cambie al instante, también sin conexión. El PATCH lo hace
// App, que lo reintenta con cada cambio de `me` hasta que el servidor lo tiene;
// sin la marca, el siguiente /me traería el idioma viejo y la app volvería a
// él sin avisar. La copia local de `me` NO se toca: es lo que dice el servidor.
export async function changeLang(l) {
  const lang = normalizeLang(l);
  if (!lang) return;
  setLang(lang);
  rememberLangLocally(lang);
  await setSetting('lang', lang);
  await clearAiCaches();

  const me = await getSetting('me');
  if (!me) return;
  await setSetting('langPending', lang);
}
