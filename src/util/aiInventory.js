import { expiryStatus } from './expires.js';

// Texto del inventario para los prompts de IA.
//
// Cada pantalla lo construía por su cuenta leyendo `it.expires`, el campo en
// días que quedó obsoleto en la migración 0006. Eso daba dos comportamientos
// rotos a la vez: los items nuevos no tienen el campo, así que nunca llevaban
// aviso aunque caducaran hoy; y los antiguos conservan una foto fija tomada al
// crearlos que no cuenta atrás, así que avisaban con días inventados (leche
// caducada hacía 86 días anunciada como "caduca en 3d").
//
// `expiryStatus` calcula el dato bueno a partir de expiresAt/frozenAt/openedAt.
export function inventoryForPrompt(items = []) {
  return items.map((it) => {
    const qty = it.type === 'continuous' ? `${it.fill}% (${it.unit})` : `${it.qty} ${it.unit}`;
    const st = expiryStatus(it);
    let exp = '';
    if (st.days != null && st.days <= 0) exp = ' ⚠ CADUCADO — no lo uses';
    else if (st.days != null && st.days <= 5) exp = ` ⚠ caduca en ${st.days}d`;
    else if (st.state === 'frozen') exp = ' ❄ congelado';
    return `- ${it.name}: ${qty}${exp}`;
  }).join('\n');
}
