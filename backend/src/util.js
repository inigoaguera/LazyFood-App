// Utilidades comunes: respuestas, CORS, ids, errores.

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

export function isAllowedOrigin(origin, env) {
  if (!origin) return false;
  const extra = (env.ALLOWED_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
  const exact = [...ALLOWED_ORIGINS, ...extra];
  if (exact.includes(origin)) return true;
  for (const allowed of extra) {
    try {
      const host = new URL(allowed).hostname;
      const oHost = new URL(origin).hostname;
      if (oHost === host || oHost.endsWith(`.${host}`)) return true;
    } catch { /* ignore */ }
  }
  return false;
}

export function corsHeaders(origin, env) {
  const extra = (env.ALLOWED_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
  const allow = isAllowedOrigin(origin, env)
    ? origin
    : (extra[0] || ALLOWED_ORIGINS[0] || '*');
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

export function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

export function errorResponse(code, message, status, headers) {
  return json({ error: { code, message } }, status, headers);
}

// IDs cortos legibles (uuid-like sin guiones)
export function uuid() {
  return crypto.randomUUID();
}

// Token corto para invitaciones / magic-link
export function randomToken(bytes = 16) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return base64url(arr);
}

export function base64url(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function safeJson(request) {
  try { return await request.json(); }
  catch { return null; }
}

export const now = () => Date.now();
