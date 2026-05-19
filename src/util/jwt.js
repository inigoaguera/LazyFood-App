// Persistencia dual del JWT: IndexedDB + localStorage.
// Razón: iOS Safari/PWA limpia IndexedDB de forma agresiva (ITP, standalone mode).
// Si lo perdemos en IndexedDB, lo recuperamos de localStorage y rehidratamos.
//
// El resto de datos (me, currentHouseholdId, etc.) se quedan sólo en IndexedDB
// porque son cache; el JWT es el único valor crítico que NO se puede perder.

import { getSetting, setSetting } from '../db.js';

const LS_KEY = 'lf_jwt';

const debug = (...args) => {
  if (typeof window !== 'undefined' && location.search.includes('debug=1')) {
    console.log('[lf-jwt]', ...args);
  }
};

export async function saveJwt(jwt) {
  debug('saveJwt called, length=', jwt?.length || 0);
  await setSetting('jwt', jwt);
  debug('saved to IndexedDB');
  try {
    if (jwt) {
      window.localStorage.setItem(LS_KEY, jwt);
      debug('saved to localStorage');
    } else {
      window.localStorage.removeItem(LS_KEY);
    }
  } catch (e) {
    debug('localStorage failed', e?.message);
  }
}

export async function getJwt() {
  const fromIdb = await getSetting('jwt');
  debug('getJwt: idb=', !!fromIdb);
  if (fromIdb) return fromIdb;
  try {
    const fromLs = window.localStorage.getItem(LS_KEY);
    debug('getJwt: ls=', !!fromLs);
    if (fromLs) {
      await setSetting('jwt', fromLs);
      debug('rehydrated jwt from localStorage to IndexedDB');
      return fromLs;
    }
  } catch (e) {
    debug('localStorage read failed', e?.message);
  }
  return null;
}

export async function clearJwt() {
  debug('clearJwt');
  await setSetting('jwt', null);
  try { window.localStorage.removeItem(LS_KEY); } catch {}
}

// Diagnóstico: devuelve el estado de todas las piezas de storage de auth.
export async function diagnose() {
  const out = {
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    standalone: typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches,
    indexedDB: { jwt: null, me: null, currentHouseholdId: null, error: null },
    localStorage: { jwt: null, error: null },
    storagePersisted: null,
  };
  try {
    const idbJwt = await getSetting('jwt');
    out.indexedDB.jwt = idbJwt ? `${String(idbJwt).slice(0, 20)}…` : null;
    const me = await getSetting('me');
    out.indexedDB.me = me?.email || null;
    out.indexedDB.currentHouseholdId = await getSetting('currentHouseholdId');
  } catch (e) {
    out.indexedDB.error = e?.message;
  }
  try {
    const lsJwt = window.localStorage.getItem(LS_KEY);
    out.localStorage.jwt = lsJwt ? `${lsJwt.slice(0, 20)}…` : null;
  } catch (e) {
    out.localStorage.error = e?.message;
  }
  try {
    if (navigator.storage?.persisted) out.storagePersisted = await navigator.storage.persisted();
  } catch {}
  return out;
}
