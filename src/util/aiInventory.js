import { expiryStatus } from './expires.js';
import { t } from '../i18n/index.js';
import { unitLabel } from '../i18n/labels.js';

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
// Firma de la despensa: el CONJUNTO de productos, sin cantidades.
//
// Sirve para caducar la lista de recetas descartadas. Con la misma despensa no
// tiene sentido volver a proponerte lo que ya has rechazado; en cuanto entra
// compra nueva (o se acaba algo del todo) el juego cambia y ese mismo plato
// puede apetecerte, así que se empieza de cero.
// Se ignoran las cantidades a propósito: gastar media botella de leche no es
// "cambiar la despensa".
export function pantrySignature(items = []) {
  return items
    .map((it) => (it.name || '').trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join('|');
}

export function inventoryForPrompt(items = []) {
  return items.map((it) => {
    const qty = it.type === 'continuous' ? `${it.fill}% (${unitLabel(it.unit)})` : `${it.qty} ${unitLabel(it.unit)}`;
    const st = expiryStatus(it);
    let exp = '';
    if (st.days != null && st.days <= 0) exp = ` ${t('ai.inv.expired')}`;
    else if (st.days != null && st.days <= 5) exp = ` ${t('ai.inv.expiresIn', { n: st.days })}`;
    else if (st.state === 'frozen') exp = ` ${t('ai.inv.frozen')}`;
    return `- ${it.name}: ${qty}${exp}`;
  }).join('\n');
}
