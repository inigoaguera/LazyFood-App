// menu_plan tiene clave compuesta [household_id, slot] — endpoint específico.
import { json, errorResponse, safeJson, now } from '../util.js';
import { isMember } from './households.js';

export async function listMenuPlan(env, cors, auth, hid, sinceParam) {
  const role = await isMember(env, hid, auth.userId);
  if (!role) return errorResponse('FORBIDDEN', 'No perteneces', 403, cors);
  const since = Number(sinceParam) || 0;
  const rows = await env.lazyfood_db.prepare(
    'SELECT slot, recipe_id, updated_at FROM menu_plan WHERE household_id=? AND updated_at > ?'
  ).bind(hid, since).all();
  return json({
    rows: (rows.results || []).map((r) => ({
      slot: r.slot, recipeId: r.recipe_id, updated_at: r.updated_at,
    })),
    serverTime: now(),
  }, 200, cors);
}

export async function setMenuSlot(request, env, cors, auth, hid) {
  const role = await isMember(env, hid, auth.userId);
  if (!role) return errorResponse('FORBIDDEN', 'No perteneces', 403, cors);
  const body = await safeJson(request) || {};
  const slot = String(body.slot || '');
  const recipeId = body.recipeId;
  if (!slot) return errorResponse('BAD_SLOT', 'slot requerido', 400, cors);
  const t = now();
  if (recipeId) {
    await env.lazyfood_db.prepare(
      `INSERT INTO menu_plan (household_id, slot, recipe_id, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(household_id, slot) DO UPDATE SET recipe_id=excluded.recipe_id, updated_at=excluded.updated_at`
    ).bind(hid, slot, String(recipeId), t).run();
  } else {
    await env.lazyfood_db.prepare(
      'DELETE FROM menu_plan WHERE household_id=? AND slot=?'
    ).bind(hid, slot).run();
  }
  return json({ ok: true, updated_at: t }, 200, cors);
}
