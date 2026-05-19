// Métodos relacionados con la sesión del usuario y casas.
import { api } from './client.js';
import { getSetting, setSetting } from '../db.js';
import { saveJwt, clearJwt } from '../util/jwt.js';

export async function requestMagicLink(email) {
  return api('/auth/request', { method: 'POST', body: { email }, auth: false });
}

export async function verifyMagicLink(token) {
  const res = await api('/auth/verify', { method: 'POST', body: { token }, auth: false });
  if (res?.jwt) {
    await saveJwt(res.jwt);
    await setSetting('me', res.user);
    try { await fetchMe(); } catch { /* no bloqueamos el verify */ }
  }
  return res;
}

// Verifica con el código OTP de 6 dígitos. Útil en PWAs donde el link no abre
// en el contexto correcto (iOS).
export async function verifyOtpCode(emailParam, code) {
  const res = await api('/auth/verify', {
    method: 'POST',
    body: { email: emailParam.trim().toLowerCase(), code: code.trim() },
    auth: false,
  });
  if (res?.jwt) {
    await saveJwt(res.jwt);
    await setSetting('me', res.user);
    try { await fetchMe(); } catch { /* no bloqueamos */ }
  }
  return res;
}

export async function logout() {
  try { await api('/auth/logout', { method: 'POST' }); } catch { /* idempotente */ }
  await clearJwt();
  await setSetting('me', null);
  await setSetting('currentHouseholdId', null);
}

export async function fetchMe() {
  const me = await api('/me');
  await setSetting('me', me);
  return me;
}

export async function patchMe(patch) {
  await api('/me', { method: 'PATCH', body: patch });
  return fetchMe();
}

export async function createHousehold(name, color) {
  return api('/households', { method: 'POST', body: { name, color } });
}

export async function getHousehold(hid) {
  return api(`/households/${hid}`);
}

export async function patchHousehold(hid, patch) {
  return api(`/households/${hid}`, { method: 'PATCH', body: patch });
}

export async function deleteHousehold(hid) {
  return api(`/households/${hid}`, { method: 'DELETE' });
}

export async function leaveOrKick(hid, userId) {
  return api(`/households/${hid}/members/${userId}`, { method: 'DELETE' });
}

export async function createInvite(hid, opts = {}) {
  return api(`/households/${hid}/invites`, { method: 'POST', body: opts });
}

export async function redeemInvite(token) {
  return api(`/invites/${token}/redeem`, { method: 'POST' });
}

export async function setCurrentHousehold(hid) {
  await setSetting('currentHouseholdId', hid);
}

export async function getCurrentHousehold() {
  return await getSetting('currentHouseholdId');
}
