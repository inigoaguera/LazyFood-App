// JWT HS256 (firma + verificación) y middleware de auth.
import { uuid, base64url, errorResponse, now } from './util.js';

const enc = new TextEncoder();
const dec = new TextDecoder();

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign', 'verify'],
  );
}

function b64urlEncode(obj) {
  return base64url(enc.encode(typeof obj === 'string' ? obj : JSON.stringify(obj)));
}

function b64urlDecodeToString(s) {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(s.length + (4 - s.length % 4) % 4, '=');
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return dec.decode(bytes);
}

export async function signJwt({ sub, jti, exp }, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = { sub, jti, iat: Math.floor(now() / 1000), exp };
  const head = b64urlEncode(header);
  const body = b64urlEncode(payload);
  const data = `${head}.${body}`;
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return `${data}.${base64url(sig)}`;
}

export async function verifyJwt(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const data = `${h}.${p}`;
  const key = await hmacKey(secret);
  const sig = Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(s.length + (4 - s.length % 4) % 4, '=')), (c) => c.charCodeAt(0));
  const ok = await crypto.subtle.verify('HMAC', key, sig, enc.encode(data));
  if (!ok) return null;
  let payload;
  try { payload = JSON.parse(b64urlDecodeToString(p)); }
  catch { return null; }
  if (payload.exp && payload.exp * 1000 < now()) return null;
  return payload;
}

// Devuelve { userId, jti } o null si la auth falla. Si la sesión está revocada en DB, también null.
export async function authenticate(request, env) {
  const header = request.headers.get('Authorization') || '';
  const m = header.match(/^Bearer\s+(.+)$/);
  if (!m) return null;
  const payload = await verifyJwt(m[1], env.JWT_SECRET);
  if (!payload?.sub || !payload?.jti) return null;
  // Confirmar que la sesión sigue viva
  const row = await env.lazyfood_db.prepare('SELECT user_id FROM sessions WHERE jti=?')
    .bind(payload.jti).first();
  if (!row || row.user_id !== payload.sub) return null;
  return { userId: payload.sub, jti: payload.jti };
}

export function requireAuth(authResult, cors) {
  if (!authResult) return errorResponse('UNAUTHORIZED', 'Sesión no válida o expirada', 401, cors);
  return null;
}

// Token de magic-link para email
export function newAuthToken() {
  return { token: uuid().replace(/-/g, ''), ttl: 15 * 60 * 1000 };
}

// Código OTP numérico de 6 dígitos para introducir manualmente en la app.
// Útil en PWAs donde los magic-links se abren en otro contexto.
export function newOtpCode() {
  const arr = new Uint8Array(4);
  crypto.getRandomValues(arr);
  const num = (arr[0] | (arr[1] << 8) | (arr[2] << 16) | (arr[3] << 24)) >>> 0;
  return String(num % 1000000).padStart(6, '0');
}

// JWT con TTL 30 días
export async function issueJwtForUser(userId, env) {
  const jti = uuid();
  const exp = Math.floor((now() + 30 * 24 * 60 * 60 * 1000) / 1000);
  const token = await signJwt({ sub: userId, jti, exp }, env.JWT_SECRET);
  await env.lazyfood_db.prepare(
    'INSERT INTO sessions (jti, user_id, issued_at, expires_at) VALUES (?, ?, ?, ?)'
  ).bind(jti, userId, now(), exp * 1000).run();
  return { token, jti, exp };
}

export async function revokeSession(jti, env) {
  await env.lazyfood_db.prepare('DELETE FROM sessions WHERE jti=?').bind(jti).run();
}
