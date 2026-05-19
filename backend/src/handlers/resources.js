// CRUD genérico por recurso. Cada recurso = una tabla en D1 con household_id.
// Los menos genéricos (menu_plan con compound key) se exportan aparte.
import { json, errorResponse, safeJson, uuid, now } from '../util.js';
import { isMember } from './households.js';

// Definición de cada recurso: tabla SQL + columnas permitidas en payload + transformaciones
const RESOURCES = {
  items: {
    table: 'items',
    columns: ['name', 'emoji', 'cat', 'loc', 'type', 'qty', 'fill', 'unit', 'expires', 'expense_id', 'price', 'shape', 'expires_at', 'frozen_at', 'opened_at'],
    fromClient: (p) => {
      const out = { ...p };
      if ('expenseId' in p) { out.expense_id = p.expenseId; delete out.expenseId; }
      if ('expiresAt' in p) { out.expires_at = p.expiresAt; delete out.expiresAt; }
      if ('frozenAt' in p) { out.frozen_at = p.frozenAt; delete out.frozenAt; }
      if ('openedAt' in p) { out.opened_at = p.openedAt; delete out.openedAt; }
      return out;
    },
    toClient: (r) => ({
      ...r,
      expenseId: r.expense_id ?? null,
      expiresAt: r.expires_at ?? null,
      frozenAt: r.frozen_at ?? null,
      openedAt: r.opened_at ?? null,
      expense_id: undefined, expires_at: undefined, frozen_at: undefined, opened_at: undefined,
    }),
  },
  recipes: {
    table: 'recipes',
    columns: ['name', 'time', 'effort', 'missing', 'missing_item', 'img', 'group', 'author'],
    // El frontend manda missingItem (camelCase) pero la columna SQL es missing_item.
    fromClient: (p) => ({ ...p, missing_item: p.missingItem ?? p.missing_item ?? null, missingItem: undefined }),
    toClient: (r) => ({ ...r, missingItem: r.missing_item, missing_item: undefined }),
  },
  shopping: {
    table: 'shopping',
    columns: ['name', 'qty', 'cat', 'checked', 'auto', 'count'],
  },
  categories: {
    table: 'categories',
    columns: ['name', 'color', 'emoji'],
  },
  expenses: {
    table: 'expenses',
    columns: ['date', 'amount', 'cat', 'store', 'saved_on_discounts', 'items_json', 'photo_url'],
    fromClient: (p) => ({
      ...p,
      saved_on_discounts: p.savedOnDiscounts ?? p.saved_on_discounts ?? null,
      items_json: p.items ? JSON.stringify(p.items) : (p.items_json ?? null),
      photo_url: p.photoUrl ?? p.photo_url ?? null,
      savedOnDiscounts: undefined, items: undefined, photoUrl: undefined,
    }),
    toClient: (r) => ({
      ...r,
      savedOnDiscounts: r.saved_on_discounts,
      items: r.items_json ? safeParse(r.items_json) : null,
      photoUrl: r.photo_url,
      saved_on_discounts: undefined, items_json: undefined, photo_url: undefined,
    }),
  },
  'recipe-details': {
    table: 'recipe_details',
    columns: ['match_name', 'name', 'time', 'effort', 'servings', 'img', 'desc', 'ingredients_json', 'steps_json', 'tools_json'],
    fromClient: (p) => ({
      ...p,
      match_name: p.matchName ?? p.match_name ?? null,
      ingredients_json: p.ingredients ? JSON.stringify(p.ingredients) : (p.ingredients_json ?? null),
      steps_json: p.steps ? JSON.stringify(p.steps) : (p.steps_json ?? null),
      tools_json: p.tools ? JSON.stringify(p.tools) : (p.tools_json ?? null),
      matchName: undefined, ingredients: undefined, steps: undefined, tools: undefined,
    }),
    toClient: (r) => ({
      ...r,
      matchName: r.match_name,
      ingredients: r.ingredients_json ? safeParse(r.ingredients_json) : null,
      steps: r.steps_json ? safeParse(r.steps_json) : null,
      tools: r.tools_json ? safeParse(r.tools_json) : null,
      match_name: undefined, ingredients_json: undefined, steps_json: undefined, tools_json: undefined,
    }),
  },
};

function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }

function pickColumns(payload, columns) {
  const out = {};
  for (const c of columns) if (c in payload) out[c] = payload[c];
  return out;
}

function quoteColumn(c) { return c === 'group' || c === 'desc' ? `"${c}"` : c; }

function toClient(spec, row) {
  const t = spec.toClient ? spec.toClient(row) : row;
  Object.keys(t).forEach((k) => { if (t[k] === undefined) delete t[k]; });
  return t;
}
function fromClient(spec, payload) {
  const t = spec.fromClient ? spec.fromClient(payload) : { ...payload };
  return pickColumns(t, spec.columns);
}

export async function listResource(env, cors, auth, hid, resourceKey, sinceParam) {
  const role = await isMember(env, hid, auth.userId);
  if (!role) return errorResponse('FORBIDDEN', 'No perteneces a esta casa', 403, cors);
  const spec = RESOURCES[resourceKey];
  if (!spec) return errorResponse('NOT_FOUND', 'Recurso desconocido', 404, cors);
  const since = Number(sinceParam) || 0;
  const cols = ['id', 'household_id', 'updated_at', 'deleted_at', ...spec.columns].map(quoteColumn).join(', ');
  let rows;
  if (since > 0) {
    rows = await env.lazyfood_db.prepare(
      `SELECT ${cols} FROM ${spec.table} WHERE household_id = ? AND updated_at > ?`
    ).bind(hid, since).all();
  } else {
    rows = await env.lazyfood_db.prepare(
      `SELECT ${cols} FROM ${spec.table} WHERE household_id = ? AND deleted_at IS NULL`
    ).bind(hid).all();
  }
  return json({
    rows: (rows.results || []).map((r) => toClient(spec, r)),
    serverTime: now(),
  }, 200, cors);
}

export async function createResource(request, env, cors, auth, hid, resourceKey) {
  const role = await isMember(env, hid, auth.userId);
  if (!role) return errorResponse('FORBIDDEN', 'No perteneces a esta casa', 403, cors);
  const spec = RESOURCES[resourceKey];
  if (!spec) return errorResponse('NOT_FOUND', 'Recurso desconocido', 404, cors);
  const payload = await safeJson(request) || {};
  const data = fromClient(spec, payload);
  const id = payload.id || uuid();
  const t = now();
  const cols = Object.keys(data);
  const colSql = ['id', 'household_id', 'updated_at', ...cols].map(quoteColumn).join(', ');
  const placeholders = ['?', '?', '?', ...cols.map(() => '?')].join(', ');
  await env.lazyfood_db.prepare(
    `INSERT INTO ${spec.table} (${colSql}) VALUES (${placeholders})`
  ).bind(id, hid, t, ...cols.map((c) => data[c])).run();
  const row = await env.lazyfood_db.prepare(
    `SELECT ${['id','household_id','updated_at','deleted_at',...spec.columns].map(quoteColumn).join(', ')} FROM ${spec.table} WHERE id=?`
  ).bind(id).first();
  return json(toClient(spec, row), 201, cors);
}

export async function patchResource(request, env, cors, auth, hid, resourceKey, id) {
  const role = await isMember(env, hid, auth.userId);
  if (!role) return errorResponse('FORBIDDEN', 'No perteneces a esta casa', 403, cors);
  const spec = RESOURCES[resourceKey];
  if (!spec) return errorResponse('NOT_FOUND', 'Recurso desconocido', 404, cors);
  const payload = await safeJson(request) || {};
  const data = fromClient(spec, payload);
  const cols = Object.keys(data);
  if (cols.length === 0) return json({ ok: true }, 200, cors);
  const sets = ['updated_at=?', ...cols.map((c) => `${quoteColumn(c)}=?`)].join(', ');
  const t = now();
  await env.lazyfood_db.prepare(
    `UPDATE ${spec.table} SET ${sets} WHERE id=? AND household_id=?`
  ).bind(t, ...cols.map((c) => data[c]), id, hid).run();
  return json({ ok: true, updated_at: t }, 200, cors);
}

export async function deleteResource(env, cors, auth, hid, resourceKey, id) {
  const role = await isMember(env, hid, auth.userId);
  if (!role) return errorResponse('FORBIDDEN', 'No perteneces a esta casa', 403, cors);
  const spec = RESOURCES[resourceKey];
  if (!spec) return errorResponse('NOT_FOUND', 'Recurso desconocido', 404, cors);
  const t = now();
  await env.lazyfood_db.prepare(
    `UPDATE ${spec.table} SET deleted_at=?, updated_at=? WHERE id=? AND household_id=?`
  ).bind(t, t, id, hid).run();
  return new Response(null, { status: 204, headers: cors });
}

export { RESOURCES, toClient, fromClient, pickColumns, quoteColumn };
