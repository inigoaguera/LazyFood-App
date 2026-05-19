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

export function recipeStockStatus(ingredients, items) {
  if (!ingredients?.length) return { state: 'ready', missing: [], partial: [], total: 0 };
  const missing = [];
  const partial = [];
  for (const ing of ingredients) {
    let match = ing.itemId ? items.find((it) => it.id === ing.itemId) : null;
    if (!match) {
      const q = (ing.name || '').toLowerCase().split(' ')[0];
      if (q) {
        match = items.find((it) => it.name?.toLowerCase().includes(q) || q.includes(it.name?.toLowerCase().split(' ')[0]));
      }
    }
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
  if (state === 'ready') return { icon: '✓', color: pal.primary, bg: pal.primarySoft, label: 'Tienes todo' };
  if (state === 'partial') return { icon: '⚠', color: pal.ink, bg: pal.accentSoft, label: 'Casi todo' };
  return { icon: '✗', color: pal.danger, bg: pal.dangerSoft, label: 'Te faltan' };
}
