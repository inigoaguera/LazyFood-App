import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db.js';
import { useLF, haptic } from '../components/ctx.js';
import { Screen, Header, IconBtn, SwipeRow, toast } from '../components/base.jsx';
import { LF_CATEGORIES } from '../tokens/categories.js';
import LFIcon from '../icons/LFIcon.jsx';
import { create as resourceCreate, patch as resourcePatch, remove as resourceRemove } from '../api/resources.js';

export default function Shopping({ onBack }) {
  const { pal, currentHouseholdMeta } = useLF();
  const hid = currentHouseholdMeta?.id;
  const items = useLiveQuery(
    () => hid ? db.shopping.where({ householdId: hid }).toArray() : Promise.resolve([]),
    [hid], []
  );
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const auto = items.filter((i) => i.auto && !i.checked);
  const manual = items.filter((i) => !i.auto && !i.checked);
  const done = items.filter((i) => i.checked);

  const toggle = async (it) => {
    try { await resourcePatch('shopping', hid, it.id, { checked: it.checked ? 0 : 1 }); }
    catch (e) { toast(e?.message || 'Error', 'error'); }
  };
  const changeCount = async (it, delta) => {
    const next = Math.max(1, (it.count || 1) + delta);
    if (next === (it.count || 1)) return;
    try { await resourcePatch('shopping', hid, it.id, { count: next }); haptic(); }
    catch (e) { toast(e?.message || 'Error', 'error'); }
  };
  const removeItem = async (it) => {
    try {
      await resourceRemove('shopping', hid, it.id);
      toast(`${it.name} eliminado`);
    } catch (e) { toast(e?.message || 'Error', 'error'); }
  };

  const clearCart = async () => {
    if (done.length === 0) return;
    if (!confirm(`¿Vaciar el carro? Se eliminarán ${done.length} item${done.length === 1 ? '' : 's'} ya marcados.`)) return;
    try {
      for (const it of done) await resourceRemove('shopping', hid, it.id);
      toast(`Carro vaciado · ${done.length} eliminados`);
    } catch (e) { toast(e?.message || 'Error', 'error'); }
  };

  const addItem = async () => {
    const name = draft.trim();
    if (!name || !hid) return;
    try {
      await resourceCreate('shopping', hid, { name, qty: '', cat: null, checked: 0, auto: 0, count: 1 });
      setDraft('');
      setAdding(false);
    } catch (e) { toast(e?.message || 'Error', 'error'); }
  };

  return (
    <Screen>
      <Header big title="Lista de la compra" subtitle={`${items.filter((i) => !i.checked).length} pendientes`}
        left={<IconBtn icon="chevronLeft" onClick={onBack} />}
        right={<IconBtn icon="more" tone="soft" />} />

      <div style={{ padding: '0 20px 6px', fontSize: 11, color: pal.inkSoft, textAlign: 'right' }}>
        ← desliza para eliminar
      </div>

      {auto.length > 0 && (
        <GroupSection title="Auto-añadidos" subtitle="Faltan para tus recetas" icon="sparkle">
          {auto.map((i) => <ShopRow key={i.id} item={i} hid={hid}
            onToggle={toggle} onCount={changeCount} onRemove={removeItem} />)}
        </GroupSection>
      )}
      {manual.length > 0 && (
        <GroupSection title="Tu lista" subtitle="Añadido por ti">
          {manual.map((i) => <ShopRow key={i.id} item={i} hid={hid}
            onToggle={toggle} onCount={changeCount} onRemove={removeItem} />)}
        </GroupSection>
      )}
      {done.length > 0 && (
        <GroupSection title="Ya en el carro" subtitle={`${done.length} items`}
          action={{ label: 'Vaciar carro', onClick: clearCart }}>
          {done.map((i) => <ShopRow key={i.id} item={i} hid={hid}
            onToggle={toggle} onCount={changeCount} onRemove={removeItem} />)}
        </GroupSection>
      )}

      <div style={{ padding: '16px 20px' }}>
        {adding ? (
          <div style={{
            display: 'flex', gap: 8, padding: 10,
            background: pal.surface, borderRadius: 14,
            border: `0.5px solid ${pal.line}`,
          }}>
            <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addItem(); if (e.key === 'Escape') setAdding(false); }}
              placeholder="Aceitunas, papel…"
              style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 14, color: pal.ink }} />
            <button onClick={addItem} style={{
              padding: '6px 12px', background: pal.primary, color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>Añadir</button>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} style={{
            width: '100%', padding: 14, background: pal.surface,
            borderRadius: 14, border: `2px dashed ${pal.lineStrong}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            color: pal.inkSoft, cursor: 'pointer', fontSize: 14, fontWeight: 600,
          }}>
            <LFIcon name="plus" size={18} />
            Añadir algo a la lista
          </button>
        )}
      </div>
    </Screen>
  );
}

const GroupSection = ({ title, subtitle, icon, action, children }) => {
  const { pal } = useLF();
  return (
    <div style={{ padding: '0 20px 14px' }}>
      <div style={{ padding: '4px 4px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
        {icon && <LFIcon name={icon} size={14} color={pal.accent} />}
        <div style={{ fontSize: 12, fontWeight: 700, color: pal.inkSoft, letterSpacing: '0.02em' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: pal.inkFaint }}>· {subtitle}</div>}
        {action && (
          <button onClick={action.onClick} style={{
            marginLeft: 'auto', background: 'transparent', border: 'none',
            color: pal.danger, fontSize: 11, fontWeight: 700, cursor: 'pointer',
            padding: '4px 8px',
          }}>🗑 {action.label}</button>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </div>
  );
};

const ShopRow = ({ item, hid, onToggle, onCount, onRemove }) => {
  const { pal } = useLF();
  return (
    <SwipeRow height={56} actions={[
      { icon: 'trash', label: 'Eliminar', bg: pal.danger, onClick: () => onRemove(item) },
    ]}>
      <ShopItem item={item} onToggle={onToggle} onCount={onCount} />
    </SwipeRow>
  );
};

const ShopItem = ({ item, onToggle, onCount }) => {
  const { pal } = useLF();
  const cat = LF_CATEGORIES.find((c) => c.id === item.cat);
  const checked = !!item.checked;
  const count = item.count || 1;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
      background: pal.surface, borderRadius: 12,
      opacity: checked ? 0.5 : 1, height: 56,
    }}>
      <button onClick={() => onToggle(item)} style={{
        width: 24, height: 24, borderRadius: 12, padding: 0, flexShrink: 0,
        border: checked ? 'none' : `1.5px solid ${pal.lineStrong}`,
        background: checked ? pal.primary : 'transparent',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {checked && <LFIcon name="check" size={14} color="#fff" strokeWidth={3} />}
      </button>
      <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => onToggle(item)}>
        <div style={{ fontSize: 14, fontWeight: 600, color: pal.ink, textDecoration: checked ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.name}
        </div>
        {(() => {
          // qty puede venir como '', '0', 0 o null — todos significan "sin cantidad" y no debemos mostrar el "0".
          const raw = item.qty;
          const qtyStr = (raw == null || raw === '' || raw === 0 || String(raw).trim() === '0') ? '' : String(raw).trim();
          const sub = qtyStr || (cat ? cat.label : '');
          if (!sub) return null;
          return (
            <div style={{ fontSize: 11, color: pal.inkSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {qtyStr}{qtyStr && cat ? ` · ${cat.label}` : ''}{!qtyStr && cat ? cat.label : ''}
            </div>
          );
        })()}
      </div>
      {Boolean(item.auto) && !checked && (
        <span style={{
          fontSize: 9, fontWeight: 700, padding: '2px 6px',
          background: pal.accentSoft, color: pal.ink, borderRadius: 8,
        }}>IA</span>
      )}
      {!checked && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 0,
          background: pal.bg, borderRadius: 14, padding: 2,
        }}>
          <CountBtn pal={pal} disabled={count <= 1} onClick={() => onCount(item, -1)}>−</CountBtn>
          <span style={{
            minWidth: 24, textAlign: 'center', fontSize: 13, fontWeight: 700, color: pal.ink, padding: '0 4px',
          }}>×{count}</span>
          <CountBtn pal={pal} onClick={() => onCount(item, +1)}>+</CountBtn>
        </div>
      )}
    </div>
  );
};

const CountBtn = ({ pal, onClick, disabled, children }) => (
  <button onClick={onClick} disabled={disabled} style={{
    width: 28, height: 28, borderRadius: 14,
    background: disabled ? 'transparent' : pal.surface,
    border: 'none', color: disabled ? pal.inkFaint : pal.ink,
    cursor: disabled ? 'default' : 'pointer',
    fontSize: 18, fontWeight: 700, lineHeight: 1, padding: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }}>{children}</button>
);
