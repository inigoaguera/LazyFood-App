// Cliente HTTP del Worker. Inyecta JWT desde IndexedDB+localStorage y lanza UNAUTHORIZED si caduca.
import { getJwt, clearJwt } from '../util/jwt.js';

const BASE = import.meta.env.VITE_API_PROXY_URL || '';

export const proxyConfigured = () => !!BASE;

let onUnauthorizedCb = null;
export function onUnauthorized(cb) { onUnauthorizedCb = cb; }

export async function api(path, { method = 'GET', body, auth = true, headers: extra = {} } = {}) {
  if (!BASE) throw new Error('VITE_API_PROXY_URL no está configurado');
  const headers = { 'Content-Type': 'application/json', ...extra };
  if (auth) {
    const jwt = await getJwt();
    if (jwt) headers.Authorization = `Bearer ${jwt}`;
  }
  const res = await fetch(`${BASE}${path}`, {
    method, headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    await clearJwt();
    if (onUnauthorizedCb) onUnauthorizedCb();
    throw new Error('UNAUTHORIZED');
  }
  if (res.status === 204) return null;
  let data = null;
  try { data = await res.json(); } catch { /* ignore */ }
  if (!res.ok) {
    const msg = data?.error?.message || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.code = data?.error?.code;
    err.status = res.status;
    throw err;
  }
  return data;
}
