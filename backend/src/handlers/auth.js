// Endpoints de autenticación: /auth/request, /auth/verify, /auth/logout
import { json, errorResponse, safeJson, uuid, now } from '../util.js';
import { newAuthToken, newOtpCode, issueJwtForUser, revokeSession, authenticate } from '../auth.js';
import { sendMagicLink } from '../email.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function authRequest(request, env, cors) {
  const body = await safeJson(request);
  const email = (body?.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return errorResponse('BAD_EMAIL', 'Email inválido', 400, cors);

  // Rate limit anti-spam: máx 10 tokens por email en la última hora.
  const since = now() - 60 * 60 * 1000;
  const count = await env.lazyfood_db.prepare(
    'SELECT COUNT(*) AS n FROM auth_tokens WHERE email=? AND expires_at > ?'
  ).bind(email, since).first();
  if (count?.n >= 10) {
    return errorResponse('RATE_LIMIT', 'Demasiados intentos. Espera un momento.', 429, cors);
  }

  const { token, ttl } = newAuthToken();
  const code = newOtpCode();
  await env.lazyfood_db.prepare(
    'INSERT INTO auth_tokens (token, email, code, expires_at) VALUES (?, ?, ?, ?)'
  ).bind(token, email, code, now() + ttl).run();

  try {
    await sendMagicLink(env, email, token, code);
  } catch (e) {
    console.error('Email error:', e);
    return errorResponse('EMAIL_FAIL', 'No se pudo enviar el email', 502, cors);
  }
  return json({ ok: true }, 200, cors);
}

export async function authVerify(request, env, cors) {
  const body = await safeJson(request) || {};
  const token = (body.token || '').trim();
  const code = (body.code || '').trim();
  const emailParam = (body.email || '').trim().toLowerCase();

  let row, matchKey;
  if (token) {
    row = await env.lazyfood_db.prepare(
      'SELECT token, email, expires_at, used_at FROM auth_tokens WHERE token=?'
    ).bind(token).first();
    matchKey = token;
  } else if (code && emailParam) {
    // Verifica por código + email (para PWAs en iOS donde el link no se puede usar)
    row = await env.lazyfood_db.prepare(
      'SELECT token, email, expires_at, used_at FROM auth_tokens WHERE code=? AND email=? AND used_at IS NULL ORDER BY expires_at DESC LIMIT 1'
    ).bind(code, emailParam).first();
    matchKey = row?.token;
  } else {
    return errorResponse('BAD_INPUT', 'Falta token o (email + código)', 400, cors);
  }
  if (!row) return errorResponse('BAD_TOKEN', 'Código o link incorrecto', 400, cors);
  if (row.used_at) return errorResponse('USED', 'Este código/link ya se usó', 400, cors);
  if (row.expires_at < now()) return errorResponse('EXPIRED', 'Caducado, pide otro link', 400, cors);

  await env.lazyfood_db.prepare(
    'UPDATE auth_tokens SET used_at=? WHERE token=?'
  ).bind(now(), matchKey).run();

  // Upsert user
  const email = row.email;
  let user = await env.lazyfood_db.prepare(
    'SELECT id, email, name, avatar, prefs_json FROM users WHERE email=?'
  ).bind(email).first();
  if (!user) {
    const id = uuid();
    await env.lazyfood_db.prepare(
      'INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)'
    ).bind(id, email, now()).run();
    user = { id, email, name: null, avatar: null, prefs_json: null };
  }

  const { token: jwt } = await issueJwtForUser(user.id, env);

  return json({
    jwt,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      prefs: user.prefs_json ? JSON.parse(user.prefs_json) : {},
    },
  }, 200, cors);
}

export async function authLogout(request, env, cors) {
  const auth = await authenticate(request, env);
  if (!auth) return json({ ok: true }, 200, cors); // idempotente
  await revokeSession(auth.jti, env);
  return json({ ok: true }, 200, cors);
}
