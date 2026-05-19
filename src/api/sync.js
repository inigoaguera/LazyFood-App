// Sync engine: pull-on-focus.
// Trae deltas de cada tabla desde la última sync para la casa actual.
import { listAll, listSince, listMenuPlan } from './resources.js';
import { getSetting, setSetting } from '../db.js';

const TABLES = ['items', 'recipes', 'shopping', 'expenses', 'recipeDetails', 'categories'];

let inflight = null;

export async function syncHousehold(hid, { full = false } = {}) {
  if (!hid) return;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const lastKey = `lastSync:${hid}`;
      const last = (await getSetting(lastKey)) || 0;
      const since = full ? 0 : last;
      const t0 = Date.now();
      // Si full=true (cambio de casa, primera vez), reseteamos cache:
      for (const t of TABLES) {
        if (full) await listAll(t, hid);
        else await listSince(t, hid, since);
      }
      if (full) await listMenuPlan(hid, 0);
      else await listMenuPlan(hid, since);
      await setSetting(lastKey, t0);
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

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
  window.addEventListener('focus', trigger);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) trigger();
  });
}
