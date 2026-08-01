// Sync engine: pull-on-focus.
// Trae deltas de cada tabla desde la última sync para la casa actual.
import { listAll, listSince, listMenuPlan } from './resources.js';
import { getSetting, setSetting } from '../db.js';

const TABLES = ['items', 'recipes', 'shopping', 'expenses', 'recipeDetails', 'categories'];

// Indexado por casa: antes era una única promesa global, así que al cambiar de
// casa con un sync en vuelo se devolvía el de la casa anterior.
const inflight = new Map();

export async function syncHousehold(hid, { full = false } = {}) {
  if (!hid) return;
  // Un full (cambio de casa, primer arranque) nunca se deduplica: tiene que
  // resetear la cache aunque haya un delta en vuelo para esa misma casa.
  if (!full && inflight.has(hid)) return inflight.get(hid);

  let run;
  run = (async () => {
    try {
      const lastKey = `lastSync:${hid}`;
      const last = (await getSetting(lastKey)) || 0;
      const since = full ? 0 : last;
      const serverTimes = [];
      const track = (res) => { if (res?.serverTime) serverTimes.push(res.serverTime); };

      for (const t of TABLES) {
        track(full ? await listAll(t, hid) : await listSince(t, hid, since));
      }
      track(await listMenuPlan(hid, full ? 0 : since));

      // Marca de agua con el reloj del SERVIDOR, no el del móvil. Guardar
      // Date.now() del cliente y compararlo contra el updated_at que sella el
      // Worker hacía que, con el reloj adelantado, todo lo escrito en esa
      // ventana quedara por debajo de la marca y no se descargara nunca más.
      // Se coge el mínimo de las respuestas y se resta 1s de margen, porque el
      // filtro del servidor es `updated_at > ?` (estricto).
      const watermark = serverTimes.length ? Math.min(...serverTimes) - 1000 : Date.now();
      await setSetting(lastKey, watermark);
    } finally {
      if (inflight.get(hid) === run) inflight.delete(hid);
    }
  })();

  inflight.set(hid, run);
  return run;
}

// Devuelve la función de limpieza para que quien lo registre pueda soltar los
// listeners (si no, cada re-registro acumularía uno más).
export function setupFocusSync(getHid) {
  let lastTrigger = 0;
  const trigger = () => {
    const hid = getHid();
    if (!hid) return;
    const now = Date.now();
    if (now - lastTrigger < 2000) return; // debounce 2s
    lastTrigger = now;
    syncHousehold(hid).catch(() => { /* swallow */ });
  };
  const onVisible = () => { if (!document.hidden) trigger(); };
  window.addEventListener('focus', trigger);
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    window.removeEventListener('focus', trigger);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
