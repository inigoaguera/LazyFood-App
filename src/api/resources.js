// Capa de datos: cada función lee/escribe vía API y ACTUALIZA la cache local
// (IndexedDB) para que los useLiveQuery sigan siendo reactivos.
import { api } from './client.js';
import { db, cachePut, cachePutMany, cacheDelete } from '../db.js';

const RES_PATH = {
  items: 'items',
  recipes: 'recipes',
  shopping: 'shopping',
  expenses: 'expenses',
  recipeDetails: 'recipe-details',
  categories: 'categories',
};

// ─── Operaciones genéricas ────────────────────────────────────────────
export async function listAll(table, hid) {
  const path = RES_PATH[table];
  const res = await api(`/households/${hid}/${path}`);
  if (Array.isArray(res?.rows)) {
    // borra cache vieja de esta casa y reescribe (snapshot completo)
    await db.table(table).where({ householdId: hid }).delete();
    await cachePutMany(table, hid, res.rows);
  }
  return res;
}

export async function listSince(table, hid, since) {
  const path = RES_PATH[table];
  const res = await api(`/households/${hid}/${path}?since=${since}`);
  for (const row of res.rows || []) {
    if (row.deleted_at) {
      await db.table(table).delete(row.id);
    } else {
      await cachePut(table, hid, row);
    }
  }
  return res;
}

export async function create(table, hid, payload) {
  const path = RES_PATH[table];
  const created = await api(`/households/${hid}/${path}`, { method: 'POST', body: payload });
  if (created?.id) await cachePut(table, hid, created);
  return created;
}

export async function patch(table, hid, id, partial) {
  const path = RES_PATH[table];
  await api(`/households/${hid}/${path}/${id}`, { method: 'PATCH', body: partial });
  // Update local cache optimistically
  const cur = await db.table(table).get(id);
  if (cur) await cachePut(table, hid, { ...cur, ...partial, updated_at: Date.now() });
}

export async function remove(table, hid, id) {
  const path = RES_PATH[table];
  await api(`/households/${hid}/${path}/${id}`, { method: 'DELETE' });
  await cacheDelete(table, hid, id);
}

// ─── menuPlan: API ligeramente distinta ──────────────────────────────
export async function listMenuPlan(hid, since = 0) {
  const res = await api(`/households/${hid}/menu-plan?since=${since}`);
  for (const r of res.rows || []) {
    await db.menuPlan.put({ householdId: hid, slot: r.slot, recipeId: r.recipeId, updated_at: r.updated_at });
  }
  return res;
}
export async function setMenuSlot(hid, slot, recipeId) {
  await api(`/households/${hid}/menu-plan`, { method: 'POST', body: { slot, recipeId } });
  if (recipeId) {
    await db.menuPlan.put({ householdId: hid, slot, recipeId, updated_at: Date.now() });
  } else {
    await db.menuPlan.delete([hid, slot]);
  }
}

// ─── Bulk import (para el wizard) ────────────────────────────────────
export async function bulkImport(hid, payload) {
  return api(`/households/${hid}/bulk-import`, { method: 'POST', body: payload });
}
