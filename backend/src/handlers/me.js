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
  // cambia ({palette}, {lang, langAt}…). Reemplazándolas enteras, un móvil (o
  // una pantalla) con una copia vieja de `me` pisaba lo que otro acababa de
  // cambiar: elegir paleta tras cambiar de idioma devolvía la cuenta al idioma
  // anterior.
  //
  // Se hace en UNA sentencia (json_patch sobre lo guardado), no leyendo y
  // escribiendo aparte: dos PATCH a la vez ya no se pisan una clave. Y el
  // idioma lleva marca de tiempo (langAt, la hora en que lo elegiste): si el
  // guardado es más reciente que el que llega, el que llega se descarta. Así un
  // cambio viejo hecho sin conexión, o un cliente antiguo que reenvía su copia
  // de prefs sin langAt, no deshace una elección más nueva hecha en otro móvil.
  if (body.prefs && typeof body.prefs === 'object' && !Array.isArray(body.prefs)) {
    const stored = "(CASE WHEN json_valid(prefs_json) THEN prefs_json ELSE '{}' END)";
    updates.push(
      `prefs_json = json_patch(${stored}, CASE`
      + ` WHEN json_extract(?, '$.lang') IS NOT NULL`
      + ` AND COALESCE(json_extract(${stored}, '$.langAt'), 0) > COALESCE(json_extract(?, '$.langAt'), 0)`
      + ` THEN json_remove(?, '$.lang', '$.langAt') ELSE ? END)`
    );
    const patch = JSON.stringify(body.prefs);
    args.push(patch, patch, patch, patch);
  }
  if (!updates.length) return json({ ok: true }, 200, cors);
  args.push(auth.userId);
  await env.lazyfood_db.prepare(
    `UPDATE users SET ${updates.join(', ')} WHERE id=?`
  ).bind(...args).run();
  return json({ ok: true }, 200, cors);
}
