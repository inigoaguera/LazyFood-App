// /me — perfil del usuario logueado y sus casas.
import { json, errorResponse, safeJson } from '../util.js';

export async function getMe(request, env, cors, auth) {
  const user = await env.lazyfood_db.prepare(
    'SELECT id, email, name, avatar, prefs_json FROM users WHERE id=?'
  ).bind(auth.userId).first();
  if (!user) return errorResponse('NO_USER', 'Usuario no encontrado', 404, cors);

  const memberships = await env.lazyfood_db.prepare(`
    SELECT h.id, h.name, h.color, h.budget, h.onboarded, m.role
    FROM memberships m
    JOIN households h ON h.id = m.household_id
    WHERE m.user_id = ?
    ORDER BY m.joined_at ASC
  `).bind(auth.userId).all();

  return json({
    id: user.id,
    email: user.email,
    name: user.name,
    avatar: user.avatar,
    prefs: user.prefs_json ? JSON.parse(user.prefs_json) : {},
    households: (memberships.results || []).map((h) => ({
      id: h.id, name: h.name, color: h.color,
      budget: h.budget, onboarded: !!h.onboarded, role: h.role,
    })),
  }, 200, cors);
}

export async function patchMe(request, env, cors, auth) {
  const body = await safeJson(request) || {};
  const updates = [];
  const args = [];
  if (typeof body.name === 'string') { updates.push('name=?'); args.push(body.name); }
  if (typeof body.avatar === 'string') { updates.push('avatar=?'); args.push(body.avatar); }
  // Las prefs se FUSIONAN con las guardadas: cada pantalla manda sólo lo que
  // cambia ({palette}, {lang}…). Reemplazándolas enteras, un móvil (o una
  // pantalla) con una copia vieja de `me` pisaba lo que otro acababa de cambiar:
  // elegir paleta tras cambiar de idioma devolvía la cuenta al idioma anterior.
  if (body.prefs && typeof body.prefs === 'object' && !Array.isArray(body.prefs)) {
    const row = await env.lazyfood_db.prepare(
      'SELECT prefs_json FROM users WHERE id=?'
    ).bind(auth.userId).first();
    let current = {};
    try { current = row?.prefs_json ? JSON.parse(row.prefs_json) || {} : {}; } catch { current = {}; }
    updates.push('prefs_json=?'); args.push(JSON.stringify({ ...current, ...body.prefs }));
  }
  if (!updates.length) return json({ ok: true }, 200, cors);
  args.push(auth.userId);
  await env.lazyfood_db.prepare(
    `UPDATE users SET ${updates.join(', ')} WHERE id=?`
  ).bind(...args).run();
  return json({ ok: true }, 200, cors);
}
