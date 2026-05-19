// Modo debug pegajoso: una vez activado con ?debug=1, persiste en localStorage
// hasta que el usuario lo desactive explícitamente. Así sobrevive a recargas
// y al magic-link (que cambia la URL).

const KEY = 'lf_debug';

export function isDebugActive() {
  if (typeof window === 'undefined') return false;
  try {
    if (location.search.includes('debug=1')) {
      window.localStorage.setItem(KEY, '1');
      return true;
    }
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function disableDebug() {
  try { window.localStorage.removeItem(KEY); } catch {}
}
