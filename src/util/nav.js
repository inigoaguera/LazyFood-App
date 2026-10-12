import { useEffect, useRef } from 'react';

// ─── Back nativo (Android) ──────────────────────────────────────────────
//
// La app no navega por URL: el "dónde estoy" vive en el estado de React.
// Para que el gesto/botón atrás del sistema no cierre la PWA, mantenemos
// UNA entrada "trampa" en el historial mientras haya algo que cerrar.
//
// Modelo: una pila lógica de capas (rutas apiladas, sheets, modales).
//   - layers.length > 0  →  hay trampa puesta  →  el back la consume y
//     nosotros cerramos la capa de arriba y volvemos a armarla.
//   - layers.length === 0  →  sin trampa  →  el back cierra la PWA, que es
//     lo que se espera estando en la pantalla raíz.
//
// Una sola trampa (en vez de una entrada por capa) evita tener que mantener
// alineados dos historiales: pase lo que pase, sólo hay dos estados posibles.

let layers = [];        // [{ id, onBack }] — cima = lo que cierra el próximo back
let seq = 0;
let armed = false;      // ¿hay entrada trampa en el historial?
let pendingBack = false; // esperando el popstate de un history.back() nuestro
let suppress = 0;       // popstates provocados por nosotros, a ignorar
let syncQueued = false;

// Agrupa los cambios del mismo tick: cerrar un sheet y navegar a la vez
// (p.ej. guardar una receta) no debe tocar el historial dos veces.
function scheduleSync() {
  if (syncQueued) return;
  syncQueued = true;
  queueMicrotask(() => { syncQueued = false; applySync(); });
}

function applySync() {
  if (pendingBack) return; // el popstate pendiente re-evaluará al llegar
  const should = layers.length > 0;
  if (should === armed) return;
  if (should) {
    window.history.pushState({ lfTrap: 1 }, '');
    armed = true;
  } else {
    pendingBack = true;
    suppress++;
    armed = false;
    window.history.back();
  }
}

function onPopState() {
  if (suppress > 0) {
    suppress--;
    pendingBack = false;
    applySync();
    return;
  }
  // El usuario consumió la trampa con el back del sistema.
  armed = false;
  const layer = layers.pop();
  if (layer) layer.onBack();
  scheduleSync();
}

let started = false;
export function initNav() {
  if (started) return;
  started = true;
  window.addEventListener('popstate', onPopState);
  // Tras un reload puede quedar una trampa de la sesión anterior: la
  // reclamamos para que applySync la retire y no se coma un back.
  if (window.history.state && window.history.state.lfTrap) armed = true;
  scheduleSync();
}

export function pushLayer(onBack) {
  const id = ++seq;
  layers.push({ id, onBack });
  scheduleSync();
  return id;
}

// Cierre iniciado por la UI (botón X, guardar, navegar): la capa ya no está
// activa. Si el back del sistema se la llevó antes, `id` ya no existe y esto
// es un no-op — así el cleanup del efecto nunca retrocede de más.
export function dropLayer(id) {
  const idx = layers.findIndex((l) => l.id === id);
  if (idx === -1) return;
  layers.splice(idx, 1);
  scheduleSync();
}

export function goBack() {
  window.history.back();
}

// Mantiene `count` capas registradas. `onPop` se llama una vez por cada capa
// que el back del sistema consuma.
export function useBackLayers(count, onPop) {
  const cb = useRef(onPop);
  cb.current = onPop;
  const ids = useRef([]);
  useEffect(() => {
    while (ids.current.length < count) ids.current.push(pushLayer(() => cb.current()));
    while (ids.current.length > count) dropLayer(ids.current.pop());
  }, [count]);
  useEffect(() => () => { ids.current.forEach(dropLayer); ids.current = []; }, []);
}

// Azúcar para sheets/modales: mientras `open` sea true, el back los cierra.
export function useBackClose(open, onClose) {
  useBackLayers(open ? 1 : 0, onClose);
}
