import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { ensureSeed } from './db.js';
import { lfEnsureFont } from './tokens/fonts.js';

lfEnsureFont('playful');

// Eruda: consola embebida para debug en móvil. Persistente vía lf_debug.
import { isDebugActive } from './util/debug.js';
if (isDebugActive()) {
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/eruda';
  s.onload = () => { if (window.eruda) window.eruda.init(); };
  document.head.appendChild(s);
  console.log('[lf-debug] eruda activado (modo debug persistente)');
}

// Solicitar almacenamiento persistente — crítico para iOS Safari/PWA, que sin
// esto puede borrar IndexedDB tras cierre de app o por su política de ITP.
async function requestPersistentStorage() {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return;
  try {
    const already = await navigator.storage.persisted();
    if (already) {
      console.log('[storage] persistent already granted');
      return;
    }
    const granted = await navigator.storage.persist();
    console.log('[storage] persistent granted:', granted);
  } catch (e) {
    console.warn('[storage] persist failed', e);
  }
}

ensureSeed().then(async () => {
  await requestPersistentStorage();
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
