// menu_plan tiene clave compuesta [household_id, slot] — endpoint específico.
import { json, errorResponse, safeJson, now } from '../util.js';
import { isMember } from './households.js';

export async function listMenuPlan(env, cors, auth, hid, sinceParam) {
  const role = await isMember(env, hid, auth.userId);
  if (!role) return errorResponse('FORBIDDEN', 'No perteneces', 403, cors);
  const since = Number(sinceParam) || 0;
  // En delta (since > 0) se devuelven también los borrados para que el cliente
  // los quite; en el snapshot completo (since = 0) no tienen sentido.
  const rows = since > 0
    ? await env.lazyfood_db.prepare(
      'SELECT slot, recipe_id, updated_at, deleted_at FROM menu_plan WHERE household_id=? AND updated_at > ?'
    ).bind(hid, since).all()
    : await env.lazyfood_db.prepare(
      'SELECT slot, recipe_id, updated_at, deleted_at FROM menu_plan WHERE household_id=? AND deleted_at IS NULL'
    ).bind(hid).all();
  return json({
    rows: (rows.results || []).map((r) => ({
      slot: r.slot, recipeId: r.recipe_id, updated_at: r.updated_at, deleted_at: r.deleted_at ?? null,
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
      `INSERT INTO menu_plan (household_id, slot, recipe_id, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, NULL)
       ON CONFLICT(household_id, slot) DO UPDATE SET
         recipe_id=excluded.recipe_id, updated_at=excluded.updated_at, deleted_at=NULL`
    ).bind(hid, slot, String(recipeId), t).run();
  } else {
    // Soft delete: la fila tiene que seguir existiendo con updated_at nuevo,
    // porque el delta sync no puede transportar una fila que ya no está.
    await env.lazyfood_db.prepare(
      'UPDATE menu_plan SET deleted_at=?, updated_at=? WHERE household_id=? AND slot=?'
    ).bind(t, t, hid, slot).run();
  }
  return json({ ok: true, updated_at: t }, 200, cors);
}
