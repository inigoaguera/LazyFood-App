// Etiquetas de los valores de dominio. La clave GUARDADA (lacteo, uds, fridge,
// yours…) no cambia; esto sólo decide cómo se enseña. Si el valor no está en
// el diccionario (p.ej. una unidad escrita a mano) se devuelve tal cual.
import { t, has, keyForLabel } from './index.js';

const label = (ns, key) => (key != null && has(`domain.${ns}.${key}`) ? t(`domain.${ns}.${key}`) : (key ?? ''));

export const catLabel = (id) => label('cat', id);
export const expenseCatLabel = (id) => label('expenseCat', id);
export const locLabel = (id) => label('loc', id);
export const locDesc = (id) => label('locDesc', id);
export const typeLabel = (id) => label('type', id);
export const shapeLabel = (id) => label('shape', id);
export const unitLabel = (u) => label('unit', u);
// Inversa de unitLabel para texto escrito a mano: "pcs" → "uds". Si no es
// una unidad conocida se queda tal cual.
export const unitKey = (text) => keyForLabel('domain.unit', text) ?? text;
export const groupLabel = (id) => label('group', id);
export const mealLabel = (id) => label('meal', id);
export const roleLabel = (id) => label('role', id);
