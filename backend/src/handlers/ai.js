// Endpoints /ai/* — proxy autenticado a Gemini.
// Mismo comportamiento que el Worker original, pero ahora sólo accesible con JWT
// y vinculado a una household (para evitar abuso de la cuota gratis).
import { json, errorResponse, safeJson } from '../util.js';
import { isMember } from './households.js';

const ALLOWED_MODELS = new Set([
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
]);

export async function aiProxy(request, env, cors, auth) {
  if (!env.GEMINI_API_KEY) {
    return errorResponse('NO_KEY', 'GEMINI_API_KEY no configurada', 500, cors);
  }
  const body = await safeJson(request);
  if (!body) return errorResponse('BAD_BODY', 'JSON inválido', 400, cors);

  const model = body.model || 'gemini-2.5-flash';
  if (!ALLOWED_MODELS.has(model)) {
    return errorResponse('BAD_MODEL', `Modelo no permitido: ${model}`, 400, cors);
  }
  if (!body.payload || typeof body.payload !== 'object') {
    return errorResponse('BAD_PAYLOAD', 'Falta payload', 400, cors);
  }
  // El cliente debe identificar la casa para la que actúa.
  const hid = body.householdId;
  if (!hid) return errorResponse('NO_HOUSEHOLD', 'Falta householdId', 400, cors);
  const role = await isMember(env, hid, auth.userId);
  if (!role) return errorResponse('FORBIDDEN', 'No perteneces a esta casa', 403, cors);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${env.GEMINI_API_KEY}`;
  let upstream;
  try {
    upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body.payload),
    });
  } catch (e) {
    return errorResponse('UPSTREAM', 'Fallo al contactar con Gemini', 502, cors);
  }
  const data = await upstream.text();
  return new Response(data, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}
