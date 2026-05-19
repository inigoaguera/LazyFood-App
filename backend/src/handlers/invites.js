// Invitaciones: generar y redimir.
import { json, errorResponse, safeJson, randomToken, now } from '../util.js';
import { isMember } from './households.js';

const DEFAULT_TTL_HOURS = 7 * 24;
const DEFAULT_MAX_USES = 5;

export async function createInvite(request, env, cors, auth, hid) {
  const role = await isMember(env, hid, auth.userId);
  if (!role) return errorResponse('FORBIDDEN', 'No perteneces a esta casa', 403, cors);

  const body = await safeJson(request) || {};
  const ttlHours = Math.max(1, Math.min(720, Number(body.ttlHours) || DEFAULT_TTL_HOURS));
  const maxUses = Math.max(1, Math.min(50, Number(body.maxUses) || DEFAULT_MAX_USES));
  const token = randomToken(8);
  const expiresAt = now() + ttlHours * 60 * 60 * 1000;

  await env.lazyfood_db.prepare(
    'INSERT INTO invites (token, household_id, created_by, expires_at, max_uses) VALUES (?, ?, ?, ?, ?)'
  ).bind(token, hid, auth.userId, expiresAt, maxUses).run();

  return json({
    token,
    url: `${env.APP_URL || 'https://lazyfood.pages.dev'}/?invite=${token}`,
    expiresAt,
    maxUses,
  }, 201, cors);
}

export async function redeemInvite(request, env, cors, auth, token) {
  const inv = await env.lazyfood_db.prepare(
    'SELECT household_id, expires_at, max_uses, used_count FROM invites WHERE token=?'
  ).bind(token).first();
  if (!inv) return errorResponse('BAD_TOKEN', 'Invitación no válida', 404, cors);
  if (inv.expires_at < now()) return errorResponse('EXPIRED', 'Invitación caducada', 400, cors);
  if (inv.used_count >= inv.max_uses) return errorResponse('USED_UP', 'Invitación agotada', 400, cors);

  // ¿ya soy miembro?
  const already = await env.lazyfood_db.prepare(
    'SELECT 1 FROM memberships WHERE household_id=? AND user_id=?'
  ).bind(inv.household_id, auth.userId).first();
  if (!already) {
    await env.lazyfood_db.batch([
      env.lazyfood_db.prepare(
        'INSERT INTO memberships (household_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)'
      ).bind(inv.household_id, auth.userId, 'member', now()),
      env.lazyfood_db.prepare(
        'UPDATE invites SET used_count = used_count + 1 WHERE token=?'
      ).bind(token),
    ]);
  }

  // Devolver datos básicos de la casa para que el frontend pueda navegar a ella
  const h = await env.lazyfood_db.prepare(
    'SELECT id, name, color FROM households WHERE id=?'
  ).bind(inv.household_id).first();

  return json({
    householdId: inv.household_id,
    name: h?.name,
    color: h?.color,
    alreadyMember: !!already,
  }, 200, cors);
}
