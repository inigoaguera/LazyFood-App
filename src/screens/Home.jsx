import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLF } from '../components/ctx.js';
import { db } from '../db.js';
import { Screen, IconBtn } from '../components/base.jsx';
import { LF_SHADOWS } from '../tokens/palettes.js';
import LFIcon from '../icons/LFIcon.jsx';
import { expiryStatus, isExpiringSoon, compareByExpiry } from '../util/expires.js';
import UseIngredient from './UseIngredient.jsx';

export default function Home({ onOpenLocation, onNav, onOpenRecipe, onOpenChat }) {
  const { pal, fonts, me, currentHouseholdMeta } = useLF();
  const hid = currentHouseholdMeta?.id;
  const [useItem, setUseItem] = useState(null);

  const items = useLiveQuery(
    () => hid ? db.items.where({ householdId: hid }).toArray() : Promise.resolve([]),
    [hid], []
  );
  const shopping = useLiveQuery(
    async () => {
      if (!hid) return [];
      const all = await db.shopping.where({ householdId: hid }).toArray();
      return all.filter((s) => !s.checked);
    },
    [hid], []
  );
  const menuFilled = useLiveQuery(
    async () => {
      if (!hid) return 0;
      const all = await db.menuPlan.where({ householdId: hid }).toArray();
      return all.filter((p) => p.recipeId).length;
    },
    [hid], 0
  );

  const userName = me?.name || (me?.email ? me.email.split('@')[0] : '');
  const householdName = currentHouseholdMeta?.name || '';
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';

  const locations = [
    { id: 'fridge',   label: 'Nevera',     emoji: '🧊', color: pal.fridge },
    { id: 'freezer',  label: 'Congelador', emoji: '❄️', color: pal.freezer },
    { id: 'pantry',   label: 'Despensa',   emoji: '🫙', color: pal.pantry },
  ].map((l) => {
    const ofLoc = items.filter((i) => i.loc === l.id);
    return { ...l, count: ofLoc.length, expiring: ofLoc.filter((i) => isExpiringSoon(i)).length };
  });

  const expiring = items
    .filter((i) => isExpiringSoon(i))
    .sort(compareByExpiry)
    .slice(0, 5);
  const totalExpiring = items.filter((i) => isExpiringSoon(i)).length;

  return (
    <Screen>
      <div style={{ padding: '12px 20px 4px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
          <div style={{ fontSize: 13, color: pal.inkSoft }}>
            {greet}{userName ? `, ${userName}` : ''}
          </div>
          {householdName && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              marginTop: 4, padding: '3px 10px', borderRadius: 12,
              background: pal.primarySoft, color: pal.primary,
              fontSize: 11, fontWeight: 700, letterSpacing: '0.02em',
            }}>
              <span style={{ fontSize: 11 }}>🏠</span>
              <span>{householdName}</span>
            </div>
          )}
          <div style={{ fontFamily: fonts.display, fontSize: 24, fontWeight: 700, color: pal.ink, letterSpacing: '-0.02em', lineHeight: 1.1, marginTop: 8, whiteSpace: 'nowrap' }}>
            ¿Qué hay hoy por casa?
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <IconBtn icon="bell" tone="soft" onClick={() => onNav('shopping')} />
          <IconBtn icon="user" tone="soft" onClick={() => onNav('profile')} />
        </div>
      </div>

      <div style={{ padding: '14px 20px 0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {totalExpiring > 0 && <StatusPill icon="clock" label={`${totalExpiring} caducan pronto`} tone="danger" />}
        <StatusPill icon="leaf" label={`${items.length} items`} tone="green" />
      </div>

      <div style={{ padding: '18px 20px 8px' }}>
        <Locations locations={locations} onOpen={onOpenLocation} />
      </div>

      {expiring.length > 0 && (
        <ExpiringStrip expiring={expiring} onOpenItem={(it) => setUseItem(it)} onSuggestRecipe={() => onNav('recipes')} />
      )}

      <div style={{ padding: '14px 20px 0' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: pal.inkFaint, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
          Accesos rápidos
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <QuickAction icon="cart" label="Lista compra" badge={shopping.length || null} onClick={() => onNav('shopping')} />
          <QuickAction icon="calendar" label="Menú semanal" sub={`${menuFilled} / 14 asignados`} onClick={() => onNav('menu')} />
        </div>
        <div style={{ marginTop: 10 }}>
          <QuickAction icon="sparkle" label="Qué ceno hoy" sub="Sugerencia IA con lo que tienes" accent wide onClick={() => onNav('recipes')} />
        </div>
      </div>

      {useItem && (
        <UseIngredient item={useItem} hid={hid}
          onOpenRecipe={(id) => { setUseItem(null); onOpenRecipe?.(id); }}
          onOpenChat={(prompt) => { setUseItem(null); onOpenChat?.(prompt); }}
          onClose={() => setUseItem(null)} />
      )}
    </Screen>
  );
}

const StatusPill = ({ icon, label, tone }) => {
  const { pal } = useLF();
  const c = tone === 'danger'
    ? { bg: pal.dangerSoft, fg: pal.danger }
    : { bg: pal.primarySoft, fg: pal.primary };
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '6px 12px', borderRadius: 14,
      background: c.bg, color: c.fg, fontSize: 12, fontWeight: 600,
    }}>
      <LFIcon name={icon} size={14} color={c.fg} />
      {label}
    </div>
  );
};

const ExpiringStrip = ({ expiring, onOpenItem, onSuggestRecipe }) => {
  const { pal } = useLF();
  return (
    <div style={{ padding: '4px 0 4px' }}>
      <div style={{ padding: '0 20px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14 }}>⏳</span>
          <div style={{ fontSize: 12, fontWeight: 700, color: pal.ink, letterSpacing: '0.01em' }}>Úsalos esta semana</div>
        </div>
        <button onClick={onSuggestRecipe} style={{
          background: 'transparent', border: 'none', color: pal.primary,
          fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0,
        }}>Recetas →</button>
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '0 20px 4px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {expiring.map((it) => {
          const exp = expiryStatus(it);
          const urgent = exp.urgent;
          const label = exp.days != null && exp.days <= 0 ? 'caducado'
            : exp.days === 1 ? 'mañana'
            : `${exp.days} días`;
          return (
            <button key={it.id} onClick={() => onOpenItem(it)} style={{
              flexShrink: 0, width: 96, padding: 10,
              background: pal.surface, borderRadius: 14,
              border: `0.5px solid ${urgent ? pal.danger : pal.line}`,
              boxShadow: LF_SHADOWS.sm, cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, textAlign: 'left',
            }}>
              <span style={{ fontSize: 26, lineHeight: 1 }}>{it.emoji}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: pal.ink, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{it.name}</span>
              <span style={{
                fontSize: 10, fontWeight: 700,
                color: urgent ? pal.danger : pal.accent,
                padding: '2px 6px', borderRadius: 6,
                background: urgent ? pal.dangerSoft : pal.accentSoft,
              }}>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const Locations = ({ locations, onOpen }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <FridgeDoor loc={locations[1]} onClick={() => onOpen('freezer')} short />
        <FridgeDoor loc={locations[0]} onClick={() => onOpen('fridge')} />
      </div>
      <div style={{ flex: 1 }}>
        <PantryDoor loc={locations[2]} onClick={() => onOpen('pantry')} />
      </div>
    </div>
  </div>
);

const FridgeDoor = ({ loc, onClick, short }) => {
  const { pal, fonts } = useLF();
  return (
    <button onClick={onClick} style={{
      height: short ? 74 : 156, width: '100%', borderRadius: 16,
      background: loc.color, border: `1px solid ${pal.line}`,
      boxShadow: LF_SHADOWS.md, position: 'relative', cursor: 'pointer',
      padding: 14, textAlign: 'left', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    }}>
      <div style={{
        position: 'absolute', right: 10, top: short ? 14 : 22, bottom: short ? 14 : 22,
        width: 5, background: 'rgba(255,255,255,0.7)', borderRadius: 3,
        boxShadow: `0 0 0 0.5px ${pal.lineStrong}`,
      }}/>
      {!short && (
        <div style={{ position: 'absolute', left: 14, right: 24, bottom: 40, display: 'flex', gap: 4, fontSize: 18 }}>
          🥛🥚🥬🍅
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: short ? 22 : 24 }}>{loc.emoji}</span>
        <span style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: short ? 16 : 18, color: pal.ink }}>{loc.label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
        <span style={{ fontSize: 12, color: pal.ink, opacity: 0.75, fontWeight: 500 }}>
          {loc.count} items{loc.expiring > 0 && ` · ${loc.expiring} urgen`}
        </span>
        <LFIcon name="arrowRight" size={16} color={pal.ink} />
      </div>
    </button>
  );
};

const PantryDoor = ({ loc, onClick }) => {
  const { pal, fonts } = useLF();
  return (
    <button onClick={onClick} style={{
      width: '100%', height: 236, borderRadius: 16,
      background: loc.color, border: `1px solid ${pal.line}`,
      boxShadow: LF_SHADOWS.md, position: 'relative', cursor: 'pointer',
      padding: 14, textAlign: 'left', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{
          position: 'absolute', left: 12, right: 12,
          top: 60 + i * 48, height: 2,
          background: 'rgba(0,0,0,0.08)', borderRadius: 1,
        }}/>
      ))}
      <div style={{ position: 'absolute', left: 16, top: 72, display: 'flex', gap: 6, fontSize: 22 }}>🫙🍝</div>
      <div style={{ position: 'absolute', left: 16, top: 118, display: 'flex', gap: 6, fontSize: 22 }}>🫒🧂</div>
      <div style={{ position: 'absolute', left: 16, top: 168, display: 'flex', gap: 6, fontSize: 22 }}>☕🫘</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative', zIndex: 1 }}>
        <span style={{ fontSize: 24 }}>{loc.emoji}</span>
        <span style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 18, color: pal.ink }}>{loc.label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
        <span style={{ fontSize: 12, color: pal.ink, opacity: 0.75, fontWeight: 500 }}>
          {loc.count} items{loc.expiring > 0 && ` · ${loc.expiring} urgen`}
        </span>
        <LFIcon name="arrowRight" size={16} color={pal.ink} />
      </div>
    </button>
  );
};

const QuickAction = ({ icon, label, badge, accent, value, sub, wide, onClick }) => {
  const { pal, fonts } = useLF();
  return (
    <button onClick={onClick} style={{
      background: accent ? pal.ink : pal.surface,
      color: accent ? pal.bg : pal.ink,
      borderRadius: 16, padding: wide ? '16px 18px' : 14, textAlign: 'left',
      border: `0.5px solid ${accent ? pal.ink : pal.line}`,
      boxShadow: LF_SHADOWS.sm, cursor: 'pointer',
      display: 'flex',
      flexDirection: wide ? 'row' : 'column',
      alignItems: wide ? 'center' : 'stretch',
      gap: wide ? 14 : 8, minHeight: wide ? 76 : 88, width: '100%',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, ...(wide ? { flexShrink: 0 } : {}) }}>
        <div style={{
          width: wide ? 44 : 32, height: wide ? 44 : 32,
          borderRadius: wide ? 22 : 16,
          background: accent ? 'rgba(255,255,255,0.12)' : pal.primarySoft,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <LFIcon name={icon} size={wide ? 22 : 18} color={accent ? pal.bg : pal.primary} strokeWidth={2} />
        </div>
        {!wide && badge && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 8px',
            borderRadius: 10, background: pal.accent, color: pal.ink,
          }}>{badge}</span>
        )}
        {!wide && value && <span style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 16 }}>{value}</span>}
      </div>
      <div style={{ flex: wide ? 1 : undefined, minWidth: 0 }}>
        <div style={{ fontSize: wide ? 16 : 14, fontWeight: 700 }}>{label}</div>
        {sub && <div style={{ fontSize: wide ? 12 : 11, opacity: 0.65, marginTop: 2 }}>{sub}</div>}
      </div>
    </button>
  );
};
