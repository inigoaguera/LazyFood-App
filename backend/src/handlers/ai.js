// Endpoints /ai/* — proxy autenticado a Gemini.
// Mismo comportamiento que el Worker original, pero ahora sólo accesible con JWT
// y vinculado a una household (para evitar abuso de la cuota gratis).
import { json, errorResponse, safeJson } from '../util.js';
import { isMember } from './households.js';

const MAX_PAYLOAD_BYTES = 12 * 1024 * 1024;
// 60 s se quedaban cortos: el hub de recetas pide 15 recetas con pasos en una
// sola llamada y los pasaba. El timeout está para que una llamada colgada no
// retenga el Worker indefinidamente, no para cortar generación legítima.
const UPSTREAM_TIMEOUT_MS = 120_000;

// Lista explícita a propósito: con una regla por prefijo ("cualquier cosa que
// contenga flash") entrarían modelos especializados como -cyber o -image, que
// comparten nombre pero no sirven para esto.
const ALLOWED_MODELS = new Set([
  // Alias dinámico: Google lo reapunta al Flash más reciente. Es el que usa la
  // app; avisan por email con dos semanas si el cambio rompe algo.
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  // Fijos, para el respaldo cuando el alias falle y para poder anclar la app a
  // una versión concreta sin tocar el Worker.
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
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

  // Techo de tamaño: la foto del ticket viaja en base64 dentro del JSON, así
  // que un envío accidental puede ser enorme. ~12 MB de payload ≈ 9 MB de
  // imagen, de sobra para cualquier ticket.
  const payloadSize = JSON.stringify(body.payload).length;
  if (payloadSize > MAX_PAYLOAD_BYTES) {
    return errorResponse('TOO_LARGE', 'La imagen es demasiado grande', 413, cors);
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${env.GEMINI_API_KEY}`;
  let upstream;
  try {
    // Sin timeout, una llamada colgada retiene el Worker hasta que Cloudflare
    // lo corta, y el usuario se queda mirando el spinner sin explicación.
    upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body.payload),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (e) {
    const timedOut = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    return errorResponse(
      timedOut ? 'AI_TIMEOUT' : 'UPSTREAM',
      timedOut ? 'La IA ha tardado demasiado en responder' : 'Fallo al contactar con Gemini',
      timedOut ? 504 : 502,
      cors,
    );
  }
  const data = await upstream.text();
  return new Response(data, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}
