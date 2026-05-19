// LazyFood Worker — router principal.
// Endpoints:
//   POST   /auth/request          {email}
//   POST   /auth/verify           {token}
//   POST   /auth/logout           (auth)
//   GET    /me                    (auth)
//   PATCH  /me                    (auth) {name?,avatar?,prefs?}
//   POST   /households            (auth)
//   GET    /households/:id        (auth)
//   PATCH  /households/:id        (auth)
//   DELETE /households/:id        (auth, owner)
//   DELETE /households/:id/members/:userId (auth)
//   POST   /households/:id/invites (auth)
//   POST   /invites/:token/redeem  (auth)
//   GET    /households/:hid/items?since=N        ┐
//   POST   /households/:hid/items                │  resources genéricos:
//   PATCH  /households/:hid/items/:id            │  items, recipes, shopping,
//   DELETE /households/:hid/items/:id            │  expenses, recipe-details
//   ... mismo patrón para los demás recursos     ┘
//   GET    /households/:hid/menu-plan?since=N
//   POST   /households/:hid/menu-plan   {slot,recipeId|null}
//   POST   /households/:hid/bulk-import  {items:[...], recipes:[...], ...}
//   POST   /ai                    (auth) {model,payload,householdId}

import { corsHeaders, errorResponse } from './util.js';
import { authenticate } from './auth.js';
import { authRequest, authVerify, authLogout } from './handlers/auth.js';
import { getMe, patchMe } from './handlers/me.js';
import {
  createHousehold, getHousehold, patchHousehold,
  deleteHousehold, removeMember,
} from './handlers/households.js';
import { createInvite, redeemInvite } from './handlers/invites.js';
import { aiProxy } from './handlers/ai.js';
import {
  listResource, createResource, patchResource, deleteResource,
} from './handlers/resources.js';
import { listMenuPlan, setMenuSlot } from './handlers/menuPlan.js';
import { bulkImport } from './handlers/bulkImport.js';

const RESOURCE_KEYS = ['items', 'recipes', 'shopping', 'expenses', 'recipe-details', 'categories'];

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    const p = url.pathname.replace(/\/+$/, '') || '/';
    const m = request.method;

    try {
      if (p === '/auth/request' && m === 'POST') return authRequest(request, env, cors);
      if (p === '/auth/verify' && m === 'POST') return authVerify(request, env, cors);

      const auth = await authenticate(request, env);
      if (!auth) return errorResponse('UNAUTHORIZED', 'Sesión no válida o expirada', 401, cors);

      if (p === '/auth/logout' && m === 'POST') return authLogout(request, env, cors);
      if (p === '/me' && m === 'GET') return getMe(request, env, cors, auth);
      if (p === '/me' && m === 'PATCH') return patchMe(request, env, cors, auth);
      if (p === '/households' && m === 'POST') return createHousehold(request, env, cors, auth);

      const householdMatch = p.match(/^\/households\/([\w-]+)(\/.*)?$/);
      if (householdMatch) {
        const hid = householdMatch[1];
        const sub = householdMatch[2] || '';

        // Casa
        if (sub === '' && m === 'GET') return getHousehold(request, env, cors, auth, hid);
        if (sub === '' && m === 'PATCH') return patchHousehold(request, env, cors, auth, hid);
        if (sub === '' && m === 'DELETE') return deleteHousehold(request, env, cors, auth, hid);
        if (sub === '/invites' && m === 'POST') return createInvite(request, env, cors, auth, hid);

        // Miembros
        const memberMatch = sub.match(/^\/members\/([\w-]+)$/);
        if (memberMatch && m === 'DELETE') return removeMember(request, env, cors, auth, hid, memberMatch[1]);

        // Bulk import
        if (sub === '/bulk-import' && m === 'POST') return bulkImport(request, env, cors, auth, hid);

        // Menu plan
        if (sub === '/menu-plan' && m === 'GET') return listMenuPlan(env, cors, auth, hid, url.searchParams.get('since'));
        if (sub === '/menu-plan' && m === 'POST') return setMenuSlot(request, env, cors, auth, hid);

        // Recursos genéricos
        for (const key of RESOURCE_KEYS) {
          if (sub === `/${key}` && m === 'GET') return listResource(env, cors, auth, hid, key, url.searchParams.get('since'));
          if (sub === `/${key}` && m === 'POST') return createResource(request, env, cors, auth, hid, key);
          const itemMatch = sub.match(new RegExp(`^/${key.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}/([\\w-]+)$`));
          if (itemMatch) {
            if (m === 'PATCH') return patchResource(request, env, cors, auth, hid, key, itemMatch[1]);
            if (m === 'DELETE') return deleteResource(env, cors, auth, hid, key, itemMatch[1]);
          }
        }
      }

      const inviteMatch = p.match(/^\/invites\/([\w-]+)\/redeem$/);
      if (inviteMatch && m === 'POST') return redeemInvite(request, env, cors, auth, inviteMatch[1]);

      if (p === '/ai' && m === 'POST') return aiProxy(request, env, cors, auth);

      return errorResponse('NOT_FOUND', `${m} ${p}`, 404, cors);
    } catch (e) {
      console.error('Worker error:', e);
      return errorResponse('SERVER_ERROR', String(e?.message || e), 500, cors);
    }
  },
};
