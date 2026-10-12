// Líneas de una compra (el desglose del ticket).
//
// Se guardan como SNAPSHOT dentro del propio gasto (expenses.items_json), no se
// derivan del inventario. Ésa es la diferencia clave: consumir, borrar o mover a
// la lista de la compra un producto ya no borra su rastro en Gastos. El registro
// de la compra es un documento histórico y no cambia por sí solo.
//
// Los items del inventario siguen guardando `expenseId` (de qué compra vinieron),
// pero eso ya sólo sirve como fallback para gastos antiguos sin snapshot.

import { t } from '../i18n/index.js';

let seq = 0;
function newLineId() {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch { /* algunos navegadores sin secure context */ }
  seq += 1;
  return `line_${Date.now().toString(36)}_${seq.toString(36)}`;
}

// Normaliza cualquier fuente (item del inventario, línea del scanner, línea ya
// guardada) al shape de línea de gasto.
export function makeLine(src = {}) {
  const rawPrice = src.price === '' || src.price == null ? null : Number(src.price);
  const rawQty = src.qty === '' || src.qty == null ? 1 : Number(src.qty);
  return {
    id: src.id || newLineId(),
    name: (src.name || '').trim() || t('common.noName'),
    emoji: src.emoji || '🛒',
    cat: src.cat || src.category || 'otros',
    qty: Number.isFinite(rawQty) ? rawQty : 1,
    unit: src.unit || 'uds',
    price: Number.isFinite(rawPrice) ? rawPrice : null,
  };
}

// Líneas a mostrar para un gasto. Si tiene snapshot manda el snapshot (incluido
// el array vacío: significa "esta compra no tiene desglose"). Si no lo tiene es
// un gasto antiguo: caemos a los items vivos que sigan vinculados.
export function expenseLines(expense, linkedItems = []) {
  if (Array.isArray(expense?.items)) return expense.items;
  return linkedItems.map((it) => makeLine(it));
}

export function linesTotal(lines = []) {
  return lines.reduce((a, l) => a + (Number(l.price) || 0), 0);
}
