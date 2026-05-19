import Dexie from 'dexie';

export const db = new Dexie('lazyfood');

// Dexie no permite cambiar la clave primaria de una tabla en la misma version.
// La migración a la schema cloud-friendly se hace en 3 pasos:
//   v1: schema original (++id auto-incremental, sin householdId)
//   v2: añade tabla 'legacy' y copia ahí todos los datos v1
//   v3: borra las tablas viejas (que ya están vaciadas en legacy)
//   v4: las recrea con clave string + householdId

// ─── v1 ──────────────────────────────────────────────────────────────
db.version(1).stores({
  items: '++id, name, cat, loc, type, expires',
  recipes: '++id, name, effort, time, group',
  shopping: '++id, name, cat, checked, auto',
  expenses: '++id, date, amount, cat, store',
  menuPlan: 'slot',
  recipeDetails: 'recipeId',
  settings: 'key',
});

// ─── v2: añadir legacy + copiar datos v1 ahí ─────────────────────────
db.version(2).stores({
  legacy: '++id, kind',
}).upgrade(async (tx) => {
  const tables = ['items', 'recipes', 'shopping', 'expenses', 'menuPlan', 'recipeDetails'];
  for (const t of tables) {
    try {
      const rows = await tx.table(t).toArray();
      if (rows.length) {
        await tx.table('legacy').add({ kind: t, rows, ts: Date.now() });
      }
      await tx.table(t).clear();
    } catch (e) {
      // la tabla puede no existir en installs frescas; ignorar
    }
  }
});

// ─── v3: eliminar las tablas con clave incompatible ──────────────────
db.version(3).stores({
  items: null,
  recipes: null,
  shopping: null,
  expenses: null,
  menuPlan: null,
  recipeDetails: null,
});

// ─── v4: recrear con clave string + householdId ──────────────────────
db.version(4).stores({
  items:         'id, householdId, [householdId+cat], [householdId+loc], expires',
  recipes:       'id, householdId, [householdId+group]',
  shopping:      'id, householdId, [householdId+checked]',
  expenses:      'id, householdId, date',
  menuPlan:      '[householdId+slot]',
  recipeDetails: 'id, householdId, [householdId+matchName]',
});

// ─── v5: tabla local para categorías personalizadas ─────────────────
db.version(5).stores({
  categories: 'id, householdId',
});

export async function getSetting(key, fallback = null) {
  const r = await db.settings.get(key);
  return r ? r.value : fallback;
}
export async function setSetting(key, value) {
  await db.settings.put({ key, value });
}

// ─── Cache helpers (escriben/leen en la cache local de la nube) ──────
// Estos los usan el sync engine y los handlers de mutación.
export async function cachePut(table, hid, row) {
  const t = db.table(table);
  if (table === 'menuPlan') {
    await t.put({ ...row, householdId: hid });
  } else {
    await t.put({ ...row, householdId: hid });
  }
}
export async function cachePutMany(table, hid, rows) {
  const enriched = rows.map((r) => ({ ...r, householdId: hid }));
  await db.table(table).bulkPut(enriched);
}
export async function cacheDelete(table, hid, id) {
  if (table === 'menuPlan') {
    // id es realmente {slot}
    await db.table(table).delete([hid, id]);
  } else {
    await db.table(table).delete(id);
  }
}
export async function cacheClearHousehold(hid) {
  const tables = ['items', 'recipes', 'shopping', 'expenses', 'menuPlan', 'recipeDetails'];
  for (const t of tables) {
    await db.table(t).where({ householdId: hid }).delete();
  }
}

// ─── Quita la antigua ensureSeed: ya no sembramos local. ─────────────
export async function ensureSeed() {
  // Compatibilidad: nada que hacer en v2. Los datos viven en la nube.
}

export async function getLegacyData() {
  const all = await db.legacy.toArray();
  // Devuelve {items: [...], recipes: [...], ...} agregando todos los snapshots
  const byKind = {};
  for (const entry of all) {
    if (!byKind[entry.kind]) byKind[entry.kind] = [];
    byKind[entry.kind].push(...entry.rows);
  }
  return byKind;
}
export async function clearLegacy() {
  await db.legacy.clear();
}
export async function hasLegacyData() {
  const c = await db.legacy.count();
  return c > 0;
}

// Helpers de lookup para nombres de recetas que usan ingredientes que caducan.
// Lo dejamos por compat con Recipes.jsx; ya no es seed estático sino mapping en runtime.
export const RECIPE_USES_EXPIRING_BY_NAME = {
  'Pasta de mamá':            ['Tomates cherry'],
  'Tortilla fácil':           ['Huevos'],
  'Ensalada caprese':         ['Tomates cherry'],
  'Bocata atún & tomate':     ['Tomates cherry'],
  'Huevos revueltos':         ['Huevos'],
  'Tostada aguacate':         [],
  'Risotto de gambas':        ['Pechuga de pollo'],
  'Pollo al curry thai':      ['Pechuga de pollo'],
  'Salmón teriyaki':          [],
  'Paella mixta':             ['Pechuga de pollo'],
  'Guacamole':                [],
};
