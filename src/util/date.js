// Devuelve la fecha LOCAL en formato YYYY-MM-DD.
// (toISOString() devuelve UTC y desplaza un día en zonas con offset distinto de 0.)
export function localISODate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
