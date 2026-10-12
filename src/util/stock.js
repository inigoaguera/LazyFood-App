// Calcula el estado de stock de una receta respecto al inventario actual.
//
// Devuelve:
//   { state: 'ready'|'partial'|'missing', missing: [...], partial: [...], total }
//
// - ready   = todos los ingredientes tienen stock > 0
// - partial = falta 1 o el item existe pero con stock bajo
// - missing = faltan 2+ ingredientes
//
// "Falta" puede ser por:
//   - itemId vinculado pero el item no existe / qty=0 / fill=0
//   - sin itemId, fuzzy match no encuentra nada
//   - sin itemId, fuzzy match sí encuentra pero stock=0

import { t, getLang } from '../i18n/index.js';

// ─── Emparejar un ingrediente (o una receta) con el inventario por nombre ──
//
// Antes cada pantalla lo hacía a su manera con subcadenas de la primera
// palabra, que fallaba de dos formas: "ingredients".includes("red") casaba
// con "Red pepper", y en inglés la primera palabra suele ser un adjetivo
// ("Tinned tuna", "Whole milk", "chicken STOCK"), así que cocinar descontaba
// el alimento equivocado.
//
// Ahora se comparan PALABRAS enteras (sin tildes; tolera plurales sencillos:
// tomato/tomatoes, huevo/huevos) y la palabra que manda es la del núcleo del
// nombre: la primera en castellano ("PECHUGA de pollo", "ACEITE de oliva") y
// la última en inglés ("chicken BREAST", "olive OIL"). Hay match si el núcleo
// del ingrediente aparece en el nombre del item o el núcleo del item en el del
// ingrediente — la misma regla que antes, pero por palabras y por idioma.
const normalize = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export const nameWords = (s) => normalize(s).split(/[^a-z0-9]+/).filter(Boolean);
const sameWord = (a, b) => a === b
  || (a.length >= 3 && b.length >= 3 && Math.abs(a.length - b.length) <= 2 && (a.startsWith(b) || b.startsWith(a)));
const hasWord = (list, w) => list.some((x) => sameWord(x, w));
const headWord = (list, lang) => (lang === 'en' ? list[list.length - 1] : list[0]);

export function namesMatch(a, b, lang = getLang()) {
  const wa = nameWords(a);
  const wb = nameWords(b);
  if (!wa.length || !wb.length) return false;
  return hasWord(wb, headWord(wa, lang)) || hasWord(wa, headWord(wb, lang));
}

export function findInventoryMatch(ingName, items, lang = getLang()) {
  if (!nameWords(ingName).length) return null;
  return items.find((it) => namesMatch(ingName, it.name, lang)) || null;
}

export function recipeStockStatus(ingredients, items) {
  if (!ingredients?.length) return { state: 'ready', missing: [], partial: [], total: 0 };
  const missing = [];
  const partial = [];
  for (const ing of ingredients) {
    let match = ing.itemId ? items.find((it) => it.id === ing.itemId) : null;
    if (!match) match = findInventoryMatch(ing.name, items);
    if (!match) { missing.push(ing); continue; }
    const stock = match.type === 'continuous' ? (match.fill || 0) : (match.qty || 0);
    if (stock <= 0) { missing.push(ing); continue; }
    // Stock bajo: < 25% o < 1 unidad → considera "partial"
    if (match.type === 'continuous' && stock < 20) partial.push(ing);
    else if (match.type === 'discrete' && stock < 1) partial.push(ing);
  }
  let state;
  if (missing.length === 0 && partial.length === 0) state = 'ready';
  else if (missing.length + partial.length === 1) state = 'partial';
  else if (missing.length === 0) state = 'partial'; // todo presente, pero algunos bajos
  else state = 'missing';
  return { state, missing, partial, total: ingredients.length };
}

// Pequeña pill visual para usar en cards. Tonos suaves (crema) con icono saturado.
export function stockBadge(state, pal) {
  if (state === 'ready') return { icon: '✓', color: pal.primary, bg: pal.primarySoft, label: t('domain.stock.ready') };
  if (state === 'partial') return { icon: '⚠', color: pal.ink, bg: pal.accentSoft, label: t('domain.stock.partial') };
  return { icon: '✗', color: pal.danger, bg: pal.dangerSoft, label: t('domain.stock.missing') };
}
