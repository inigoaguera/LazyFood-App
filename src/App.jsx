import React, { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { LFCtx } from './components/ctx.js';
import { LF_PALETTES, LF_DENSITIES } from './tokens/palettes.js';
import { LF_FONTS, lfEnsureFont } from './tokens/fonts.js';
import { db, setSetting, hasLegacyData } from './db.js';
import { onUnauthorized } from './api/client.js';
import { fetchMe, setCurrentHousehold, patchHousehold } from './api/session.js';
import { syncHousehold, setupFocusSync } from './api/sync.js';
import { getJwt } from './util/jwt.js';

import { BottomNav, ToastHost } from './components/base.jsx';
import DebugOverlay from './screens/DebugOverlay.jsx';
import { isDebugActive } from './util/debug.js';
import Login from './screens/Login.jsx';
import Verify from './screens/Verify.jsx';
import HouseholdPicker from './screens/HouseholdPicker.jsx';
import CreateHousehold from './screens/CreateHousehold.jsx';
import JoinHousehold from './screens/JoinHousehold.jsx';
import ImportLocalData from './screens/ImportLocalData.jsx';
import Onboarding from './screens/Onboarding.jsx';
import Home from './screens/Home.jsx';
import Inventory from './screens/Inventory.jsx';
import AddEditModal from './screens/AddEditItem.jsx';
import RecipeHub from './screens/Recipes.jsx';
import RecipeDetail from './screens/RecipeDetail.jsx';
import AntojosChat from './screens/AntojosChat.jsx';
import Scanner from './screens/Scanner.jsx';
import Shopping from './screens/Shopping.jsx';
import Expenses from './screens/Expenses.jsx';
import Menu from './screens/Menu.jsx';
import Profile from './screens/Profile.jsx';

const AppStyles = ({ pal, fonts }) => (
  <style>{`
    @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; height: 100%; overscroll-behavior-y: contain; }
    body {
      font-family: ${fonts.body};
      background: ${pal.bg};
      color: ${pal.ink};
      -webkit-font-smoothing: antialiased;
      overflow-x: hidden;
    }
    button { font-family: inherit; }
    input, textarea { font-family: inherit; }
    ::-webkit-scrollbar { display: none; }
  `}</style>
);

// Lee ?token y ?invite de la URL una sola vez en boot, los limpia para evitar replays.
function readUrlParams() {
  const u = new URL(window.location.href);
  const token = u.searchParams.get('token');
  const invite = u.searchParams.get('invite');
  if (token || invite) {
    u.searchParams.delete('token');
    u.searchParams.delete('invite');
    window.history.replaceState({}, '', u.pathname + (u.search ? u.search : '') + u.hash);
  }
  return { token, invite };
}

export default function App() {
  // Settings cached in IndexedDB
  const settings = useLiveQuery(async () => {
    const all = await db.settings.toArray();
    return Object.fromEntries(all.map((s) => [s.key, s.value]));
  }, [], {});

  // ─── Auth state ──────────────────────────────────────────
  const me = settings.me || null;
  const jwt = settings.jwt || null;
  const currentHousehold = settings.currentHouseholdId || null;
  const myHouseholds = me?.households || [];
  const myHouseholdMeta = myHouseholds.find((h) => h.id === currentHousehold) || null;

  // Theme: prefer current user's prefs, fallback to old global settings
  const userPrefs = me?.prefs || {};
  const palette = userPrefs.palette || settings.palette || 'huerto';
  const fontKey = userPrefs.font || settings.font || 'playful';
  const densityKey = userPrefs.density || settings.density || 'regular';

  useEffect(() => { lfEnsureFont(fontKey); }, [fontKey]);

  const pal = LF_PALETTES[palette] || LF_PALETTES.huerto;
  const fonts = LF_FONTS[fontKey] || LF_FONTS.playful;
  const dens = LF_DENSITIES[densityKey] || LF_DENSITIES.regular;
  const ctx = useMemo(() => ({
    pal, fonts, dens, settings,
    me, currentHousehold, currentHouseholdMeta: myHouseholdMeta,
  }), [pal, fonts, dens, settings, me, currentHousehold, myHouseholdMeta]);

  // ─── URL params (magic link / invite) ────────────────────
  const [urlParams] = useState(() => readUrlParams());
  const [pendingInvite, setPendingInvite] = useState(urlParams.invite || settings.pendingInvite || null);

  useEffect(() => {
    if (urlParams.invite && !jwt) {
      setSetting('pendingInvite', urlParams.invite);
    }
  }, [urlParams.invite, jwt]);

  // ─── 401 handler global ─────────────────────────────────
  useEffect(() => {
    onUnauthorized(() => {
      setSetting('me', null);
      setSetting('currentHouseholdId', null);
    });
  }, []);

  // ─── Rehidratar JWT desde localStorage si IndexedDB lo perdió ──
  // Crítico en iOS Safari/PWA — la política de storage suele borrar IndexedDB.
  useEffect(() => {
    getJwt().catch(() => {});
  }, []);

  // ─── Cargar /me al boot si hay JWT ──────────────────────
  const [meChecked, setMeChecked] = useState(false);
  useEffect(() => {
    (async () => {
      if (jwt && (!me || !me.households) && !meChecked) {
        try { await fetchMe(); } catch { /* ignored */ }
        setMeChecked(true);
      } else if (!jwt) {
        setMeChecked(false);
      }
    })();
  }, [jwt, me, meChecked]);

  // ─── Detectar datos legacy de v1 (para wizard de import) ──
  const [hasLegacy, setHasLegacy] = useState(false);
  const [legacyChecked, setLegacyChecked] = useState(false);
  useEffect(() => {
    (async () => {
      const has = await hasLegacyData();
      setHasLegacy(has);
      setLegacyChecked(true);
    })();
  }, []);

  // ─── Sync al cambiar de casa + on-focus ────────────────
  useEffect(() => {
    if (currentHousehold) {
      syncHousehold(currentHousehold, { full: true }).catch(() => {});
    }
  }, [currentHousehold]);

  useEffect(() => {
    setupFocusSync(() => settings.currentHouseholdId || null);
    // setup once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Routing dentro de la app ──────────────────────────
  const [route, setRoute] = useState('home');
  const [params, setParams] = useState({});
  const [modal, setModal] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const go = (r, p = {}) => { setRoute(r); setParams(p); };

  // ─── Render decisión: árbol auth → casa → app ───────────
  const screen = (() => {
    // 1. Aterrizó con magic-link en URL → Verify
    if (urlParams.token) {
      return <Verify token={urlParams.token} pendingInvite={pendingInvite}
        onSuccess={async (joinedHid) => {
          await setSetting('pendingInvite', null);
          setPendingInvite(null);
          if (joinedHid) await setCurrentHousehold(joinedHid);
          window.location.reload();
        }}
        onFailure={() => window.location.reload()} />;
    }
    // 2. Sin JWT → Login
    if (!jwt) {
      return <Login pendingInvite={pendingInvite} />;
    }
    // 3. JWT pero no hay /me todavía → loading
    if (!me) {
      return <div style={{
        height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: pal.inkSoft, fontSize: 14,
      }}>Cargando…</div>;
    }
    // 4. ¿Hay datos legacy v1 sin importar y aún no tienes casas? → Wizard
    if (legacyChecked && hasLegacy && myHouseholds.length === 0 && route !== 'createHousehold' && route !== 'joinHousehold') {
      return <ImportLocalData
        onDone={async (hid) => { setHasLegacy(false); await setCurrentHousehold(hid); go('home'); }}
        onSkip={() => { setHasLegacy(false); go('householdPicker'); }} />;
    }

    // 5. ¿Casa actual válida?
    const isValidHid = currentHousehold && myHouseholds.some((h) => h.id === currentHousehold);
    if (!isValidHid) {
      if (route === 'createHousehold') {
        return <CreateHousehold onCreated={() => go('home')} onBack={() => go('householdPicker')} />;
      }
      if (route === 'joinHousehold') {
        return <JoinHousehold onJoined={() => go('home')} onBack={() => go('householdPicker')} />;
      }
      return <HouseholdPicker
        onPick={() => go('home')}
        onCreate={() => go('createHousehold')}
        onJoin={() => go('joinHousehold')}
        onLogout={() => window.location.reload()} />;
    }

    // 5b. Onboarding por casa: si esta casa aún no se ha "presentado", muestra slides.
    if (myHouseholdMeta && myHouseholdMeta.onboarded === false && route !== 'profile') {
      return <Onboarding onDone={async () => {
        try {
          await patchHousehold(myHouseholdMeta.id, { onboarded: true });
          await fetchMe();
        } catch { /* ignored */ }
        go('home');
      }} />;
    }

    // 6. App normal
    switch (route) {
      case 'home':       return <Home onOpenLocation={(loc) => go('list', { loc })} onNav={(t) => go(t)} onOpenRecipe={(id) => go('recipeDetail', { id })} onOpenChat={(prompt) => go('antojos', { prompt })} />;
      case 'list':       return <Inventory initialLoc={params.loc || 'all'} onBack={() => go('home')} onEdit={(it) => { setEditItem(it); setModal('edit'); }} onAdd={() => { setEditItem(null); setModal('add'); }} />;
      case 'recipes':    return <RecipeHub onBack={() => go('home')} onOpenRecipe={(id) => go('recipeDetail', { id })} onOpenChat={() => go('antojos')} />;
      case 'recipeDetail': return <RecipeDetail recipeId={params.id} onBack={() => go('recipes')} onCooked={() => go('home')} />;
      case 'antojos':    return <AntojosChat onClose={() => go('recipes')} onOpenRecipe={(id) => go('recipeDetail', { id })} initialPrompt={params.prompt} />;
      case 'scan':       return <Scanner onBack={() => go('home')} onDone={() => go('list')} />;
      case 'shopping':   return <Shopping onBack={() => go('home')} />;
      case 'expenses':   return <Expenses onBack={() => go('home')} />;
      case 'menu':       return <Menu onBack={() => go('home')} onOpenRecipe={(id) => go('recipeDetail', { id })} />;
      case 'profile':    return <Profile onBack={() => go('home')}
                              onSwitchHousehold={async () => { await setCurrentHousehold(null); go('home'); }}
                              onLogout={() => window.location.reload()} />;
      // Si ya está en casa válida y por algún motivo entra a estas, redirige
      case 'householdPicker':
      case 'createHousehold':
      case 'joinHousehold':
        go('home');
        return null;
      default: return null;
    }
  })();

  // BottomNav sólo dentro de la app principal (no en onboarding-de-casa ni en pantallas full-screen).
  const insideApp = !!jwt && !!me && currentHousehold && myHouseholds.some((h) => h.id === currentHousehold);
  const inHouseholdOnboarding = myHouseholdMeta && myHouseholdMeta.onboarded === false && route !== 'profile';
  const showBottomNav = insideApp
    && !inHouseholdOnboarding
    && !['scan', 'recipeDetail', 'antojos'].includes(route);

  return (
    <LFCtx.Provider value={ctx}>
      <AppStyles pal={pal} fonts={fonts} />
      <div style={{
        position: 'fixed', inset: 0,
        background: pal.bg,
        display: 'flex', flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top)',
        overflow: 'hidden',
      }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
          {screen}
          {showBottomNav && (
            <BottomNav active={route} onNav={(tab) => go(tab)} onScan={() => go('scan')} />
          )}
          {modal && insideApp && (
            <AddEditModal
              item={editItem}
              onClose={() => setModal(null)}
              onSaved={() => setModal(null)} />
          )}
          <ToastHost />
          {isDebugActive() && <DebugOverlay />}
        </div>
      </div>
    </LFCtx.Provider>
  );
}
