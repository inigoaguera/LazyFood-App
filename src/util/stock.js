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

import { t } from '../i18n/index.js';

// ─── Emparejar un ingrediente (o una receta) con el inventario por nombre ──
//
// Los ingredientes sin vincular (los de la IA, sobre todo) se buscan en el
// inventario por nombre para el badge de stock, para descontar al cocinar y
// para "úsalo ya". Aquí un falso positivo es peor que un fallo: descuenta el
// alimento equivocado. Por eso la regla es conservadora y NO depende del
// idioma de la interfaz (en una casa con tickets españoles y la app en inglés
// los nombres siguen en castellano):
//
//   1. Se comparan palabras clave: sin tildes, sin mayúsculas, sin palabras
//      vacías (de, con, of, the…) ni tamaños/envases de ticket (1L, x6, 700g,
//      pack, bote…). Plurales sólo regulares: huevo/huevos, limón/limones,
//      tomato/tomatoes, nuez/nueces, berry/berries. "sal" ≠ "salsa".
//   2. Mejor caso: mismas palabras ("Pechuga pollo 700g" ↔ "pechuga de pollo").
//   3. Luego: todas las palabras de uno están en el otro ("tuna" ↔ "Tinned
//      tuna", "arroz" ↔ "Arroz basmati", "Huevos" ↔ "huevos camperos").
//   4. Por último, misma variedad de un producto: coinciden en la primera
//      palabra y no es un adjetivo ni salsa/caldo… ("salsa de soja" ↛ "salsa de tomate") ("leche entera" ↔ "Leche desnatada",
//      "arroz integral" ↔ "Arroz basmati"; no "whole milk" ↔ "Whole chicken").
//   En ningún caso casan un producto y uno derivado de él: si un nombre dice
//   salsa/caldo/zumo/polvo/sauce/stock/juice… y el otro no, no hay match
//   ("salsa de tomate" ↛ "Tomates", "chicken stock" ↛ "Chicken breast").
//   Entre varios candidatos gana el de mejor nivel y, a igualdad, el de nombre
//   más parecido en longitud.
const normalize = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export const nameWords = (s) => normalize(s).split(/[^a-z0-9]+/).filter(Boolean);

const STOP = new Set([
  'de', 'del', 'la', 'las', 'el', 'los', 'en', 'con', 'al', 'a', 'y', 'e', 'o', 'para', 'sin',
  'of', 'the', 'and', 'with', 'in', 'an', 'for', 'or',
  // Envases y tamaños que meten los tickets.
  'x', 'pack', 'packs', 'paquete', 'paquetes', 'bote', 'botes', 'brick', 'bandeja', 'malla', 'bolsa', 'bag',
  'kg', 'g', 'gr', 'grs', 'l', 'ml', 'cl', 'lt', 'ud', 'uds', 'unidad', 'unidades', 'pcs', 'pc',
]);
// Palabras que convierten un alimento en OTRO producto.
const FORMS = new Set([
  'salsa', 'sauce', 'caldo', 'stock', 'broth', 'zumo', 'jugo', 'juice', 'mermelada', 'jam',
  'sopa', 'soup', 'crema', 'cream', 'pure', 'puree', 'polvo', 'powder', 'harina', 'flour',
  'vinagre', 'vinegar', 'helado', 'licor', 'liqueur', 'pasta', 'paste',
]);
// Adjetivos que no identifican el producto aunque vayan primero.
const MODIFIERS = new Set([
  'whole', 'fresh', 'frozen', 'tinned', 'canned', 'grated', 'sliced', 'diced', 'chopped', 'dried', 'ground',
  'smoked', 'natural', 'plain', 'mixed', 'organic', 'free', 'range', 'baby', 'red', 'green', 'yellow',
  'black', 'white', 'brown', 'sweet', 'light', 'low', 'skimmed', 'semi', 'large', 'small', 'easy',
  'fresco', 'fresca', 'congelado', 'congelada',
]);

const keyWords = (s) => nameWords(s).filter((w) => !STOP.has(w) && !/\d/.test(w));
const sameWord = (a, b) => {
  if (a === b) return true;
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  return l === `${s}s` || l === `${s}es`
    || (s.endsWith('z') && l === `${s.slice(0, -1)}ces`)
    || (s.endsWith('y') && l === `${s.slice(0, -1)}ies`);
};
const contains = (list, w) => list.some((x) => sameWord(x, w));
const subset = (a, b) => a.every((w) => contains(b, w));
const formMismatch = (a, b) => a.some((w) => FORMS.has(w) && !contains(b, w)) || b.some((w) => FORMS.has(w) && !contains(a, w));

// Nivel de parecido entre dos nombres: 3 iguales, 2 uno dentro del otro,
// 1 misma variedad, 0 nada.
export function matchLevel(a, b) {
  const wa = keyWords(a);
  const wb = keyWords(b);
  if (!wa.length || !wb.length || formMismatch(wa, wb)) return 0;
  if (subset(wa, wb) && subset(wb, wa)) return 3;
  if (subset(wa, wb) || subset(wb, wa)) return 2;
  if (sameWord(wa[0], wb[0]) && !MODIFIERS.has(wa[0]) && !FORMS.has(wa[0])) return 1;
  return 0;
}
export const namesMatch = (a, b) => matchLevel(a, b) > 0;

export function findInventoryMatch(ingName, items) {
  const target = keyWords(ingName).length;
  let best = null;
  let bestLevel = 0;
  let bestGap = Infinity;
  for (const it of items) {
    const level = matchLevel(ingName, it.name);
    if (!level) continue;
    const gap = Math.abs(keyWords(it.name).length - target);
    if (level > bestLevel || (level === bestLevel && gap < bestGap)) {
      best = it; bestLevel = level; bestGap = gap;
    }
  }
  return best;
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
