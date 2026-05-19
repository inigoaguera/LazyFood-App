// Lógica de caducidad: traduce el modelo (expiresAt + frozenAt + openedAt)
// en datos listos para pintar.

export const DAY_MS = 24 * 60 * 60 * 1000;

// Días de frescura por categoría cuando el item se "abre" o se mueve a la nevera.
export const FRESH_DAYS_BY_CAT = {
  lacteo: 7,
  verdura: 5,
  fruta: 7,
  carne: 3,
  pescado: 2,
  pasta: 360,
  conserva: 5,         // una vez ABIERTA, dura poco en nevera
  bebida: 14,
  snack: 30,
  congelado: 60,
  salsa: 30,
  especia: 365,
};

export function freshDaysFor(cat, loc) {
  if (loc === 'freezer') return 90;
  return FRESH_DAYS_BY_CAT[cat] ?? 14;
}

// Devuelve la fecha de caducidad sugerida (timestamp ms) para un item nuevo.
// Si la categoría es de larga conservación + despensa cerrada → null (sin caducidad).
export function suggestedExpiresAt(cat, loc, openedAt = null, now = Date.now()) {
  const sealedInPantry = loc === 'pantry'
    && ['conserva', 'pasta', 'especia', 'salsa', 'bebida', 'snack'].includes(cat);
  if (sealedInPantry && !openedAt) return null;
  return now + freshDaysFor(cat, loc) * DAY_MS;
}

// Estado de caducidad para pintar:
//   { state: 'sealed'|'frozen'|'expired'|'soon'|'ok'|'unknown',
//     label: string para el usuario,
//     days:  número o null,
//     urgent, warn (booleans) }
export function expiryStatus(item, now = Date.now()) {
  if (item.frozenAt != null) {
    return { state: 'frozen', label: 'congelado', days: null, urgent: false, warn: false };
  }
  if (item.expiresAt == null) {
    if (item.openedAt == null) {
      return { state: 'sealed', label: 'sin caducidad', days: null, urgent: false, warn: false };
    }
    return { state: 'sealed', label: 'sin caducidad', days: null, urgent: false, warn: false };
  }
  const diffMs = item.expiresAt - now;
  const days = Math.ceil(diffMs / DAY_MS);
  if (days <= 0) return { state: 'expired', label: 'caducado', days, urgent: true, warn: false };
  if (days === 1) return { state: 'soon', label: 'mañana', days, urgent: true, warn: false };
  if (days < 4)  return { state: 'soon',  label: `en ${days} días`, days, urgent: true, warn: false };
  if (days < 8)  return { state: 'ok',    label: `en ${days} días`, days, urgent: false, warn: true };
  if (days < 30) return { state: 'ok',    label: `en ${Math.ceil(days / 7)} sem`, days, urgent: false, warn: false };
  return { state: 'ok', label: `en ${Math.ceil(days / 30)} m`, days, urgent: false, warn: false };
}

// Útil para "úsalos esta semana" en Home: items que caducan pronto y no congelados.
export function isExpiringSoon(item, threshold = 4, now = Date.now()) {
  if (item.frozenAt != null) return false;
  if (item.expiresAt == null) return false;
  const days = Math.ceil((item.expiresAt - now) / DAY_MS);
  return days <= threshold;
}

// Para ordenar por caducidad: nulls al final.
export function compareByExpiry(a, b, now = Date.now()) {
  const aFrozen = a.frozenAt != null;
  const bFrozen = b.frozenAt != null;
  // Congelados al final entre los "sin caducidad cercana"
  const aDays = aFrozen || a.expiresAt == null ? Infinity : (a.expiresAt - now);
  const bDays = bFrozen || b.expiresAt == null ? Infinity : (b.expiresAt - now);
  return aDays - bDays;
}

// Convertir días desde HOY a expiresAt absoluto (helper para el editor).
export function daysToTs(days, now = Date.now()) {
  if (days == null || days === '') return null;
  const n = Number(days);
  if (!Number.isFinite(n)) return null;
  return now + n * DAY_MS;
}
