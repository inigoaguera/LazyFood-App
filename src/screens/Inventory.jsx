import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLF, haptic } from '../components/ctx.js';
import { db } from '../db.js';
import { useCategories } from '../util/categories.js';
import { Screen, Header, IconBtn, Chip, SwipeRow, toast } from '../components/base.jsx';
import LFIcon from '../icons/LFIcon.jsx';
import { patch as resourcePatch, create as resourceCreate, remove as resourceRemove } from '../api/resources.js';
import { syncHousehold } from '../api/sync.js';
import { expiryStatus, compareByExpiry, DAY_MS } from '../util/expires.js';

// Detecta si un item está agotado (qty=0 o fill=0)
const isEmpty = (it) => {
  if (it.type === 'continuous') return (it.fill ?? 0) <= 0;
  return (it.qty ?? 0) <= 0;
};

export default function Inventory({ initialLoc = 'all', onBack, onEdit, onAdd }) {
  const { pal, currentHouseholdMeta } = useLF();
  const hid = currentHouseholdMeta?.id;
  const allCategories = useCategories(hid);
  const [loc, setLoc] = useState(initialLoc);
  const [cat, setCat] = useState('all');
  const [search, setSearch] = useState('');
  const [emptySheet, setEmptySheet] = useState(null); // item con qty=0
  const [movingItem, setMovingItem] = useState(null); // item que se va a mover
  const sort = 'expires';

  const items = useLiveQuery(
    () => hid ? db.items.where({ householdId: hid }).toArray() : Promise.resolve([]),
    [hid], []
  );

  const filtered = items
    .filter((i) => loc === 'all' || i.loc === loc)
    .filter((i) => cat === 'all' || i.cat === cat)
    .filter((i) => !search || i.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sort === 'expires' ? compareByExpiry(a, b) : a.name.localeCompare(b.name));

  const grouped = {};
  filtered.forEach((i) => { grouped[i.loc] = grouped[i.loc] || []; grouped[i.loc].push(i); });

  const locs = [
    { id: 'all', label: 'Todo' },
    { id: 'fridge', label: 'Nevera' },
    { id: 'freezer', label: 'Congelador' },
    { id: 'pantry', label: 'Despensa' },
  ];
  const locLabel = { fridge: 'Nevera', freezer: 'Congelador', pantry: 'Despensa' };
  const locEmoji = { fridge: '🧊', freezer: '❄️', pantry: '🫙' };

  const decrement = async (it) => {
    try {
      if (it.type === 'discrete') {
        // Si la cantidad ya es fraccionaria, restamos 0.25 para no pasarnos.
        const cur = Number(it.qty) || 0;
        const step = (cur > 0 && cur < 1) || !Number.isInteger(cur) ? 0.25 : 1;
        const next = Math.max(0, +(cur - step).toFixed(2));
        if (next === 0) await resourceRemove('items', hid, it.id);
        else await resourcePatch('items', hid, it.id, { qty: next });
      } else {
        const next = Math.max(0, (it.fill || 0) - 10);
        await resourcePatch('items', hid, it.id, { fill: next });
      }
    } catch (e) { toast(e?.message || 'Error', 'error'); }
    haptic();
  };
  // Abre el sheet de destino al deslizar Mover.
  const moveLocation = (it) => setMovingItem(it);

  // Aplica el movimiento. qty puede ser parcial sólo para items discretos.
  const applyMove = async (it, dest, qtyToMove) => {
    try {
      const isDiscrete = it.type === 'discrete';
      const totalQty = isDiscrete ? Number(it.qty) || 0 : 0;
      const moveAll = !isDiscrete || qtyToMove == null || qtyToMove >= totalQty;
      const moveQty = moveAll ? totalQty : Number(qtyToMove);

      // ─── Destino: lista de la compra ───────────────────
      if (dest === 'shopping') {
        await resourceCreate('shopping', hid, {
          name: it.name, qty: '', cat: it.cat || null,
          checked: 0, auto: 0, count: isDiscrete ? Math.max(1, Math.round(moveQty)) : 1,
        });
        if (moveAll) {
          await resourceRemove('items', hid, it.id);
        } else {
          await resourcePatch('items', hid, it.id, { qty: +(totalQty - moveQty).toFixed(2) });
        }
        toast(moveAll ? `${it.name} → lista de compra 🛒` : `${moveQty} de ${it.name} → compra 🛒`);
        return;
      }

      // ─── Destinos de inventario ────────────────────────
      const now = Date.now();
      const buildLocPatch = (targetLoc, fromFrozen) => {
        const patch = { loc: targetLoc };
        if (targetLoc === 'freezer' && !fromFrozen) {
          patch.frozenAt = now;
        } else if (targetLoc !== 'freezer' && fromFrozen) {
          const frozenDuration = now - it.frozenAt;
          if (it.expiresAt) patch.expiresAt = it.expiresAt + frozenDuration;
          patch.frozenAt = null;
        }
        return patch;
      };

      if (moveAll) {
        const patch = buildLocPatch(dest, it.frozenAt != null);
        await resourcePatch('items', hid, it.id, patch);
        toast(dest === 'freezer' && patch.frozenAt
          ? `🧊 ${it.name} congelado`
          : `Movido a ${locLabel[dest]}`);
      } else {
        // Partial move discreto: crea un nuevo item en dest con moveQty,
        // decrementa el original.
        const newItem = {
          name: it.name, emoji: it.emoji, cat: it.cat,
          loc: dest,
          type: 'discrete',
          qty: moveQty,
          unit: it.unit,
          expiresAt: it.expiresAt ?? null,
          frozenAt: dest === 'freezer' ? now : null,
          openedAt: it.openedAt ?? null,
        };
        await resourceCreate('items', hid, newItem);
        await resourcePatch('items', hid, it.id, { qty: +(totalQty - moveQty).toFixed(2) });
        toast(`${moveQty} de ${it.name} → ${locLabel[dest]}`);
      }
    } catch (e) { toast(e?.message || 'Error', 'error'); }
  };
  const removeItem = async (it) => {
    try {
      await resourceRemove('items', hid, it.id);
      toast(`${it.name} eliminado`);
    } catch (e) { toast(e?.message || 'Error', 'error'); }
  };

  return (
    <Screen>
      <Header big title="Todos los alimentos" subtitle={`${filtered.length} items encontrados`}
        left={<IconBtn icon="chevronLeft" onClick={onBack} />}
        right={<><IconBtn icon="plus" tone="soft" onClick={onAdd} /><IconBtn icon="more" tone="soft" /></>} />

      <div style={{ padding: '4px 20px 10px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: pal.surface, borderRadius: 14,
          border: `0.5px solid ${pal.line}`, padding: '10px 14px',
        }}>
          <LFIcon name="search" size={18} color={pal.inkSoft} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Busca 'tomates', 'leche'…"
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 14, color: pal.ink }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, padding: '0 20px 10px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {locs.map((l) => (
          <Chip key={l.id} label={l.label} active={loc === l.id} onClick={() => setLoc(l.id)}
            count={l.id === 'all' ? items.length : items.filter((i) => i.loc === l.id).length} />
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, padding: '0 20px 14px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <Chip label="Todas" active={cat === 'all'} onClick={() => setCat('all')} />
        {allCategories.map((c) => (
          <Chip key={c.id} label={c.label} color={c.color} active={cat === c.id} onClick={() => setCat(c.id)} />
        ))}
      </div>

      <div style={{ padding: '0 20px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, color: pal.inkFaint, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Ordenado por · caducidad
        </div>
        <div style={{ fontSize: 11, color: pal.inkSoft }}>← desliza para acciones</div>
      </div>

      <div style={{ padding: '0 20px' }}>
        {Object.entries(grouped).map(([lkey, list]) => (
          <div key={lkey} style={{ marginBottom: 14 }}>
            {loc === 'all' && (
              <div style={{
                padding: '10px 4px 6px', display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 12, fontWeight: 700, color: pal.inkSoft, letterSpacing: '0.02em',
              }}>
                <span>{locEmoji[lkey]}</span>
                <span>{locLabel[lkey]}</span>
                <span style={{ color: pal.inkFaint, fontWeight: 500 }}>· {list.length}</span>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {list.map((it) => {
                const empty = isEmpty(it);
                return (
                  <SwipeRow key={it.id} height={68} actions={[
                    { icon: 'minus', label: '-1',       bg: pal.accent, fg: pal.ink, onClick: () => decrement(it) },
                    { icon: 'move',  label: 'Mover',    bg: pal.cool,   onClick: () => moveLocation(it) },
                    { icon: 'trash', label: 'Eliminar', bg: pal.danger, onClick: () => removeItem(it) },
                  ]}>
                    <ItemRow item={it} empty={empty} categories={allCategories}
                      onClick={() => empty ? setEmptySheet(it) : onEdit?.(it)} />
                  </SwipeRow>
                );
              })}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: pal.inkFaint }}>
            Nada por aquí. Añade algo con el escáner 📸
          </div>
        )}
      </div>

      {emptySheet && (
        <EmptyItemSheet item={emptySheet} hid={hid}
          onClose={() => setEmptySheet(null)}
          onEdit={() => { const it = emptySheet; setEmptySheet(null); onEdit?.(it); }} />
      )}

      {movingItem && (
        <MoveSheet item={movingItem}
          onClose={() => setMovingItem(null)}
          onMove={async (dest, qtyToMove) => {
            const it = movingItem;
            setMovingItem(null);
            await applyMove(it, dest, qtyToMove);
          }} />
      )}
    </Screen>
  );
}

const MoveSheet = ({ item, onClose, onMove }) => {
  const { pal, fonts } = useLF();
  const isDiscrete = item.type === 'discrete';
  const total = isDiscrete ? Number(item.qty) || 0 : 0;
  const allowPartial = isDiscrete && total > 1;
  const [qty, setQty] = useState(total); // por defecto mover todo
  const [fineMode, setFineMode] = useState(false);
  const step = fineMode ? 0.25 : 1;
  const display = Number.isInteger(qty) ? qty : Number(qty).toFixed(2).replace(/0+$/, '').replace(/\.$/, '');

  const options = [
    { id: 'fridge',   icon: '🧊', label: 'Nevera',     desc: 'Refrigerar' },
    { id: 'freezer',  icon: '❄️', label: 'Congelador', desc: 'Detiene la cuenta de caducidad' },
    { id: 'pantry',   icon: '🫙', label: 'Despensa',   desc: 'Conservar a temperatura ambiente' },
    { id: 'shopping', icon: '🛒', label: 'Lista de la compra', desc: 'Lo quitas del inventario y se añade a la lista' },
  ].filter((o) => o.id !== item.loc);

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 50,
      background: 'rgba(20,25,18,0.45)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-end',
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', background: pal.bg,
        borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden',
        animation: 'slideUp .28s cubic-bezier(.3,.7,.4,1)',
      }}>
        <div style={{ padding: '10px 0 4px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: pal.lineStrong }}/>
        </div>
        <div style={{ padding: '10px 22px 14px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: pal.inkFaint, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Mover
          </div>
          <div style={{ fontFamily: fonts.display, fontSize: 18, fontWeight: 700, color: pal.ink, marginTop: 2 }}>
            {item.emoji} {item.name}
          </div>
        </div>

        {allowPartial && (
          <div style={{
            margin: '0 22px 14px', padding: 14,
            background: pal.surface, borderRadius: 14, border: `0.5px solid ${pal.line}`,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: pal.inkSoft, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>
              ¿Cuánto mueves?
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
              <button onClick={() => setQty((q) => Math.max(0.25, +(q - step).toFixed(2)))} style={moveStepBtn(pal, false)}>−</button>
              <div style={{ textAlign: 'center', minWidth: 100 }}>
                <div style={{ fontFamily: fonts.display, fontSize: 38, fontWeight: 800, color: pal.ink, lineHeight: 1 }}>{display}</div>
                <div style={{ fontSize: 11, color: pal.inkSoft, marginTop: 2 }}>de {total} {item.unit}</div>
              </div>
              <button onClick={() => setQty((q) => Math.min(total, +(q + step).toFixed(2)))} style={moveStepBtn(pal, true)}>+</button>
            </div>
            <button onClick={() => setFineMode((f) => !f)} style={{
              marginTop: 8, width: '100%', padding: '4px 10px', borderRadius: 10,
              background: fineMode ? pal.primarySoft : 'transparent',
              color: fineMode ? pal.primary : pal.inkFaint,
              border: `0.5px solid ${fineMode ? pal.primary : pal.line}`,
              fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}>
              {fineMode ? '🔬 paso 0.25' : 'paso 1 · toca para 0.25'}
            </button>
          </div>
        )}

        {options.map((o) => (
          <button key={o.id} onClick={() => onMove(o.id, allowPartial ? qty : null)} style={{
            display: 'flex', alignItems: 'center', gap: 14,
            width: '100%', padding: '14px 22px',
            background: pal.surface, border: 'none', cursor: 'pointer',
            textAlign: 'left',
            borderTop: `0.5px solid ${pal.line}`,
          }}>
            <span style={{ fontSize: 24, width: 32, textAlign: 'center' }}>{o.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: pal.ink }}>{o.label}</div>
              <div style={{ fontSize: 11, color: pal.inkSoft, marginTop: 2 }}>{o.desc}</div>
            </div>
            {allowPartial && (
              <div style={{ fontSize: 11, color: pal.inkFaint, fontWeight: 600 }}>
                {qty >= total ? 'todo' : `${display} ${item.unit}`}
              </div>
            )}
          </button>
        ))}
        <div style={{ height: 16 }}/>
      </div>
    </div>
  );
};

const moveStepBtn = (pal, primary) => ({
  width: 44, height: 44, borderRadius: 22,
  background: primary ? pal.primary : pal.bg,
  color: primary ? '#fff' : pal.ink,
  border: primary ? 'none' : `0.5px solid ${pal.line}`,
  fontSize: 20, fontWeight: 700, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
});

// Sheet que aparece al pulsar un item agotado
const EmptyItemSheet = ({ item, hid, onClose, onEdit }) => {
  const { pal, fonts } = useLF();
  const handleAddToShopping = async () => {
    try {
      await resourceCreate('shopping', hid, {
        name: item.name, qty: '', cat: item.cat || null,
        checked: 0, auto: 0, count: 1,
      });
      // Lo quitamos del inventario — está agotado y queda fichado en la compra.
      // Cuando se registre el siguiente ticket entrará de nuevo.
      await resourceRemove('items', hid, item.id);
      await syncHousehold(hid);
      toast(`${item.name} → lista de compra 🛒`);
      onClose();
    } catch (e) { toast(e?.message || 'Error', 'error'); }
  };
  const handleDelete = async () => {
    if (!confirm(`¿Eliminar "${item.name}" del inventario?`)) return;
    try {
      await resourceRemove('items', hid, item.id);
      await syncHousehold(hid);
      toast(`${item.name} eliminado`);
      onClose();
    } catch (e) { toast(e?.message || 'Error', 'error'); }
  };
  const Action = ({ icon, label, onClick, danger }) => (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 14,
      width: '100%', padding: '14px 18px',
      background: pal.surface, border: 'none', cursor: 'pointer',
      textAlign: 'left', fontSize: 15, fontWeight: 600,
      color: danger ? pal.danger : pal.ink,
      borderTop: `0.5px solid ${pal.line}`,
    }}>
      <span style={{ fontSize: 22, width: 28, textAlign: 'center' }}>{icon}</span>
      <span>{label}</span>
    </button>
  );
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 50,
      background: 'rgba(20,25,18,0.45)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-end',
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', background: pal.bg,
        borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden',
        animation: 'slideUp .28s cubic-bezier(.3,.7,.4,1)',
      }}>
        <div style={{ padding: '10px 0 4px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: pal.lineStrong }}/>
        </div>
        <div style={{ padding: '14px 20px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 24, background: pal.dangerSoft,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
          }}>{item.emoji || '⚠️'}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: pal.danger, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Agotado
            </div>
            <div style={{ fontFamily: fonts.display, fontSize: 17, fontWeight: 700, color: pal.ink }}>{item.name}</div>
          </div>
        </div>
        <Action icon="🛒" label="Añadir a la lista de la compra" onClick={handleAddToShopping} />
        <Action icon="✏️" label="Editar / reponer" onClick={onEdit} />
        <Action icon="🗑" label="Eliminar del inventario" onClick={handleDelete} danger />
        <div style={{ height: 16 }}/>
      </div>
    </div>
  );
};

const ItemRow = ({ item, empty, categories, onClick }) => {
  const { pal } = useLF();
  const cat = (categories || []).find((c) => c.id === item.cat);
  const exp = expiryStatus(item);
  const urgent = exp.urgent;
  const warn = exp.warn;
  const frozen = exp.state === 'frozen';
  const expiresLabel = exp.label;
  const qtyVal = item.type === 'continuous' ? item.fill : item.qty;
  const qtyDisplay = item.type === 'continuous' ? `${qtyVal ?? 0}%` : `${qtyVal ?? 0} ${item.unit || ''}`.trim();
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 12px', height: 68,
      background: empty ? pal.dangerSoft : pal.surface,
      borderRadius: 14,
      border: `0.5px solid ${empty ? pal.danger : pal.line}`,
      cursor: 'pointer',
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 22,
        background: cat?.color || pal.primarySoft,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0,
      }}>{item.emoji}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: pal.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <span style={{ fontSize: 11, color: pal.inkSoft }}>{qtyDisplay}</span>
          <span style={{ width: 3, height: 3, borderRadius: 1.5, background: pal.inkFaint }}/>
          <span style={{ fontSize: 11, fontWeight: 600, color: urgent ? pal.danger : warn ? pal.accent : frozen ? pal.cool : pal.inkSoft }}>
            {urgent && '⏳ '}{warn && '👀 '}{frozen && '🧊 '}{expiresLabel}
          </span>
        </div>
      </div>
      {item.type === 'continuous' ? (
        <div style={{ width: 10, height: 36, background: pal.line, borderRadius: 5, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: `${item.fill}%`,
            background: item.fill < 25 ? pal.danger : item.fill < 50 ? pal.accent : pal.primary,
            borderRadius: 5,
          }}/>
        </div>
      ) : (
        <div style={{
          minWidth: 32, height: 32, padding: '0 8px',
          background: pal.primarySoft, color: pal.primary,
          borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, flexShrink: 0,
        }}>{item.qty}</div>
      )}
    </div>
  );
};
