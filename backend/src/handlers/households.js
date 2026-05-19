// CRUD de casas + miembros.
import { json, errorResponse, safeJson, uuid, now } from '../util.js';

export async function isMember(env, householdId, userId) {
  const row = await env.lazyfood_db.prepare(
    'SELECT role FROM memberships WHERE household_id=? AND user_id=?'
  ).bind(householdId, userId).first();
  return row?.role || null;
}

export async function createHousehold(request, env, cors, auth) {
  const body = await safeJson(request) || {};
  const name = (body.name || '').trim();
  if (!name) return errorResponse('BAD_NAME', 'Nombre requerido', 400, cors);
  const color = body.color || '#4A7C3A';
  const id = uuid();
  const t = now();

  await env.lazyfood_db.batch([
    env.lazyfood_db.prepare(
      'INSERT INTO households (id, name, color, created_by, created_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, name, color, auth.userId, t),
    env.lazyfood_db.prepare(
      'INSERT INTO memberships (household_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)'
    ).bind(id, auth.userId, 'owner', t),
  ]);
  return json({ id, name, color, role: 'owner', onboarded: false, budget: null }, 201, cors);
}

export async function getHousehold(request, env, cors, auth, hid) {
  const role = await isMember(env, hid, auth.userId);
  if (!role) return errorResponse('FORBIDDEN', 'No perteneces a esta casa', 403, cors);

  const h = await env.lazyfood_db.prepare(
    'SELECT id, name, color, budget, onboarded FROM households WHERE id=?'
  ).bind(hid).first();
  if (!h) return errorResponse('NOT_FOUND', 'Casa no encontrada', 404, cors);

  const members = await env.lazyfood_db.prepare(`
    SELECT u.id, u.email, u.name, u.avatar, m.role, m.joined_at
    FROM memberships m
    JOIN users u ON u.id = m.user_id
    WHERE m.household_id = ?
    ORDER BY m.joined_at ASC
  `).bind(hid).all();

  return json({
    id: h.id, name: h.name, color: h.color,
    budget: h.budget, onboarded: !!h.onboarded,
    role,
    members: members.results || [],
  }, 200, cors);
}

export async function patchHousehold(request, env, cors, auth, hid) {
  const role = await isMember(env, hid, auth.userId);
  if (!role) return errorResponse('FORBIDDEN', 'No perteneces a esta casa', 403, cors);

  const body = await safeJson(request) || {};
  const updates = []; const args = [];
  if (typeof body.name === 'string') { updates.push('name=?'); args.push(body.name); }
  if (typeof body.color === 'string') { updates.push('color=?'); args.push(body.color); }
  // onboarded y budget pueden actualizarse por cualquier miembro
  if (typeof body.onboarded === 'boolean') { updates.push('onboarded=?'); args.push(body.onboarded ? 1 : 0); }
  if (typeof body.budget === 'number') { updates.push('budget=?'); args.push(body.budget); }
  if (!updates.length) return json({ ok: true }, 200, cors);
  // name/color sólo owner
  if ((body.name || body.color) && role !== 'owner') {
    return errorResponse('FORBIDDEN', 'Sólo el owner puede cambiar nombre/color', 403, cors);
  }
  args.push(hid);
  await env.lazyfood_db.prepare(
    `UPDATE households SET ${updates.join(', ')} WHERE id=?`
  ).bind(...args).run();
  return json({ ok: true }, 200, cors);
}

export async function deleteHousehold(request, env, cors, auth, hid) {
  const role = await isMember(env, hid, auth.userId);
  if (role !== 'owner') return errorResponse('FORBIDDEN', 'Sólo el owner puede borrar la casa', 403, cors);
  await env.lazyfood_db.prepare('DELETE FROM households WHERE id=?').bind(hid).run();
  return new Response(null, { status: 204, headers: cors });
}

export async function removeMember(request, env, cors, auth, hid, targetUserId) {
  const role = await isMember(env, hid, auth.userId);
  if (!role) return errorResponse('FORBIDDEN', 'No perteneces a esta casa', 403, cors);
  // Permitido si: eres el target (te sales) O eres owner expulsando a otro
  if (targetUserId !== auth.userId && role !== 'owner') {
    return errorResponse('FORBIDDEN', 'Sólo el owner puede expulsar miembros', 403, cors);
  }
  // Owner no puede expulsarse a sí mismo si es el único owner (evita casa huérfana)
  if (targetUserId === auth.userId && role === 'owner') {
    const owners = await env.lazyfood_db.prepare(
      "SELECT COUNT(*) AS n FROM memberships WHERE household_id=? AND role='owner'"
    ).bind(hid).first();
    if ((owners?.n || 0) <= 1) {
      return errorResponse('LAST_OWNER', 'Eres el único owner. Asciende a otro miembro o borra la casa.', 400, cors);
    }
  }
  await env.lazyfood_db.prepare(
    'DELETE FROM memberships WHERE household_id=? AND user_id=?'
  ).bind(hid, targetUserId).run();
  return new Response(null, { status: 204, headers: cors });
}
