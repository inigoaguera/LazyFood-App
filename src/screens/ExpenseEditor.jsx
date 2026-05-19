import React, { useEffect, useState } from 'react';
import { useLF } from '../components/ctx.js';
import { Button, toast } from '../components/base.jsx';
import { LF_CATEGORIES } from '../tokens/categories.js';
import {
  create as resourceCreate, patch as resourcePatch, remove as resourceRemove,
} from '../api/resources.js';
import { syncHousehold } from '../api/sync.js';
import { localISODate } from '../util/date.js';

// Modal full-screen para añadir / editar / borrar un gasto.
// Los items son entidades reales del inventario vinculadas con expense_id.
// Editar/añadir/borrar items aquí afecta al inventario directamente.
export default function ExpenseEditor({ expense, linkedItems = [], defaultDate, hid, onClose, onSaved }) {
  const { pal, fonts } = useLF();
  const editing = !!expense?.id;
  const [date, setDate] = useState(expense?.date || defaultDate || localISODate());
  const [store, setStore] = useState(expense?.store || '');
  const [amount, setAmount] = useState(expense?.amount != null ? String(expense.amount) : '');
  const [saved, setSaved] = useState(expense?.savedOnDiscounts != null ? String(expense.savedOnDiscounts) : '');
  // Mezclamos items existentes (con id real) y nuevos (sin id, _new flag)
  const [items, setItems] = useState(() => linkedItems.map((it) => ({ ...it })));
  const [busy, setBusy] = useState(false);

  // Si recibo nuevos items vinculados (porque el sync llegó después), los reflejo.
  useEffect(() => {
    if (linkedItems && linkedItems.length && items.every((i) => i._new)) {
      setItems(linkedItems.map((it) => ({ ...it })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedItems.length]);

  const itemsSum = items.reduce((a, b) => a + (Number(b.price) || 0), 0);
  const total = amount !== '' ? Number(amount) : itemsSum;

  const addItem = () => setItems((xs) => [...xs, {
    _new: true, name: '', emoji: '🛒', cat: 'conserva', loc: 'pantry',
    type: 'discrete', qty: 1, unit: 'uds', expires: 14, price: null,
  }]);
  const updateItem = (i, patch) => setItems((xs) => xs.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  const markRemoved = (i) => setItems((xs) => xs.map((it, idx) => idx === i ? { ...it, _delete: true } : it));

  const save = async () => {
    if (!store.trim()) { toast('Pon dónde compraste', 'error'); return; }
    if (!total || Number.isNaN(total)) { toast('Pon un total válido', 'error'); return; }
    setBusy(true);
    try {
      const expensePayload = {
        date, store: store.trim(),
        amount: Number(total),
        cat: 'super',
        savedOnDiscounts: saved === '' ? null : Number(saved),
      };
      let expenseId = expense?.id;
      if (editing) {
        await resourcePatch('expenses', hid, expense.id, expensePayload);
      } else {
        const created = await resourceCreate('expenses', hid, expensePayload);
        expenseId = created?.id;
      }

      // Sincronizar items vinculados
      for (const it of items) {
        if (it._delete) {
          if (it.id) await resourceRemove('items', hid, it.id);
          continue;
        }
        if (!it.name?.trim()) continue;
        const type = it.type === 'continuous' ? 'continuous' : 'discrete';
        const itemPayload = {
          name: it.name.trim(),
          emoji: it.emoji || '🛒',
          cat: it.cat || 'conserva',
          loc: it.loc || 'pantry',
          type,
          shape: type === 'continuous' ? (it.shape || 'bottle') : null,
          qty: it.qty != null ? Number(it.qty) : 1,
          fill: type === 'continuous' ? (it.fill ?? 100) : null,
          unit: it.unit || (type === 'continuous' ? 'L' : 'uds'),
          expires: it.expires == null || it.expires === '' ? null : Number(it.expires),
          price: it.price != null && it.price !== '' ? Number(it.price) : null,
          expenseId,
        };
        if (it._new) {
          await resourceCreate('items', hid, itemPayload);
        } else if (it.id) {
          // Sólo enviamos los campos modificables (omitimos householdId, etc.)
          await resourcePatch('items', hid, it.id, itemPayload);
        }
      }

      toast(editing ? 'Cambios guardados' : 'Gasto añadido');
      await syncHousehold(hid);
      onSaved?.();
    } catch (e) {
      toast(e?.message || 'Error', 'error');
    } finally { setBusy(false); }
  };

  const handleDelete = async () => {
    if (!editing) return;
    if (!confirm('¿Borrar este gasto? Los items vinculados quedan en el inventario.')) return;
    try {
      await resourceRemove('expenses', hid, expense.id);
      // Desvinculamos los items pero los dejamos en inventario
      for (const it of linkedItems) {
        try { await resourcePatch('items', hid, it.id, { expenseId: null }); } catch { /* ignore */ }
      }
      toast('Gasto borrado');
      await syncHousehold(hid);
      onSaved?.();
    } catch (e) { toast(e?.message || 'Error', 'error'); }
  };

  const visible = items.filter((i) => !i._delete);

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 60,
      background: pal.bg,
      display: 'flex', flexDirection: 'column',
      animation: 'slideUp .28s cubic-bezier(.3,.7,.4,1)',
    }}>
      <div style={{
        padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `0.5px solid ${pal.line}`,
      }}>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: pal.inkSoft, fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
        <div style={{ fontFamily: fonts.display, fontSize: 17, fontWeight: 700, color: pal.ink }}>
          {editing ? 'Editar compra' : 'Nueva compra'}
        </div>
        <button onClick={save} disabled={busy} style={{
          background: 'transparent', border: 'none',
          color: pal.primary, fontSize: 14, fontWeight: 700, cursor: busy ? 'default' : 'pointer',
        }}>{busy ? '…' : 'Guardar'}</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <Field label="Fecha">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle(pal)} />
            </Field>
          </div>
          <div style={{ flex: 2 }}>
            <Field label="Supermercado">
              <input value={store} onChange={(e) => setStore(e.target.value)}
                placeholder="Mercadona, Lidl…" style={inputStyle(pal)} />
            </Field>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <Field label="Total (€)">
              <input type="number" inputMode="decimal" value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={itemsSum.toFixed(2)} style={inputStyle(pal)} />
              <div style={{ fontSize: 10, color: pal.inkFaint, marginTop: 4 }}>
                Suma items: {itemsSum.toFixed(2)}€
              </div>
            </Field>
          </div>
          <div style={{ flex: 1 }}>
            <Field label="Ahorro ofertas (€)">
              <input type="number" inputMode="decimal" value={saved}
                onChange={(e) => setSaved(e.target.value)}
                placeholder="0" style={inputStyle(pal)} />
            </Field>
          </div>
        </div>

        <div style={{
          padding: 10, background: pal.surface, borderRadius: 10,
          border: `0.5px solid ${pal.line}`, marginBottom: 14,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 20 }}>📷</span>
          <div style={{ flex: 1, fontSize: 11, color: pal.inkSoft, lineHeight: 1.4 }}>
            La foto del ticket se podrá guardar en cuanto activemos R2 (próximamente).
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <Label>Productos comprados ({visible.length})</Label>
            <button onClick={addItem} style={{
              background: pal.primarySoft, color: pal.primary,
              border: 'none', borderRadius: 10, padding: '6px 12px',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>+ Añadir</button>
          </div>
          <div style={{ fontSize: 11, color: pal.inkFaint, marginBottom: 8 }}>
            Estos son los items que entraron en tu despensa con esta compra. Edítalos también para cambiar tu inventario.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {visible.map((it, idx) => (
              <ItemEditor key={it.id || idx} item={it} pal={pal}
                onChange={(patch) => updateItem(items.indexOf(it), patch)}
                onRemove={() => markRemoved(items.indexOf(it))} />
            ))}
            {visible.length === 0 && (
              <div style={{ padding: 14, fontSize: 12, color: pal.inkFaint, textAlign: 'center' }}>
                Sin productos. Toca "Añadir" o deja sólo el total.
              </div>
            )}
          </div>
        </div>

        {editing && (
          <button onClick={handleDelete} style={{
            width: '100%', padding: 12, marginTop: 10,
            background: pal.dangerSoft, border: 'none', borderRadius: 12,
            color: pal.danger, fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>
            🗑 Borrar este gasto
          </button>
        )}
      </div>
    </div>
  );
}

const ItemEditor = ({ item, pal, onChange, onRemove }) => {
  const [open, setOpen] = useState(!!item._new);
  return (
    <div style={{
      background: pal.surface, borderRadius: 10, border: `0.5px solid ${pal.line}`, overflow: 'hidden',
    }}>
      <div onClick={() => setOpen((x) => !x)} style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: 10, cursor: 'pointer',
      }}>
        <span style={{ fontSize: 20, width: 28, textAlign: 'center' }}>{item.emoji || '🛒'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: pal.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name || 'Sin nombre'}</div>
          <div style={{ fontSize: 11, color: pal.inkSoft }}>
            {item.qty || 1} {item.unit || 'uds'}
            {item.price != null ? ` · ${Number(item.price).toFixed(2)}€` : ''}
            {item.cat ? ` · ${LF_CATEGORIES.find((c) => c.id === item.cat)?.label || item.cat}` : ''}
          </div>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onRemove(); }} style={{
          background: 'transparent', border: 'none', color: pal.danger,
          fontSize: 18, cursor: 'pointer', padding: 4,
        }}>×</button>
      </div>
      {open && (
        <div style={{ padding: '0 10px 10px', borderTop: `0.5px solid ${pal.line}` }}>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <input value={item.emoji || ''} onChange={(e) => onChange({ emoji: e.target.value })}
              style={{ width: 44, padding: 8, fontSize: 18, textAlign: 'center', border: 'none', background: pal.bg, borderRadius: 8 }} />
            <input value={item.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Producto"
              style={{ flex: 1, padding: 8, fontSize: 13, border: 'none', background: pal.bg, borderRadius: 8 }} />
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <TypeBtn pal={pal} active={item.type !== 'continuous'} onClick={() => onChange({ type: 'discrete', shape: null, unit: 'uds', fill: null })}>
              Discreto
            </TypeBtn>
            <TypeBtn pal={pal} active={item.type === 'continuous'} onClick={() => onChange({ type: 'continuous', shape: item.shape || 'bottle', unit: item.unit && ['L','ml','kg','g'].includes(item.unit) ? item.unit : 'L', fill: 100 })}>
              Continuo
            </TypeBtn>
          </div>
          {item.type === 'continuous' && (
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              {[{ id: 'bottle', label: '🍶 Botella' }, { id: 'jar', label: '🫙 Tarro' }, { id: 'sack', label: '🛍️ Saco' }].map((s) => (
                <TypeBtn key={s.id} pal={pal} active={item.shape === s.id} onClick={() => onChange({ shape: s.id })}>
                  {s.label}
                </TypeBtn>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <input type="number" inputMode="decimal" value={item.qty || ''}
              onChange={(e) => onChange({ qty: Number(e.target.value) || 1 })}
              placeholder="1"
              style={{ width: 60, padding: 8, fontSize: 13, border: 'none', background: pal.bg, borderRadius: 8, textAlign: 'center' }} />
            <select value={item.unit || (item.type === 'continuous' ? 'L' : 'uds')} onChange={(e) => onChange({ unit: e.target.value })}
              style={{ width: 80, padding: 8, fontSize: 13, border: 'none', background: pal.bg, borderRadius: 8 }}>
              {item.type === 'continuous'
                ? ['L', 'ml', 'kg', 'g'].map((u) => <option key={u} value={u}>{u}</option>)
                : ['uds', 'latas', 'paquetes'].map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center',
              background: pal.bg, borderRadius: 8, paddingRight: 8,
            }}>
              <input type="number" inputMode="decimal" value={item.price ?? ''}
                onChange={(e) => onChange({ price: e.target.value === '' ? null : Number(e.target.value) })}
                placeholder="0.00"
                style={{ flex: 1, padding: 8, fontSize: 13, border: 'none', background: 'transparent', outline: 'none', textAlign: 'right' }} />
              <span style={{ fontSize: 13, color: pal.inkSoft, fontWeight: 600 }}>€</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <select value={item.cat || 'conserva'} onChange={(e) => onChange({ cat: e.target.value })}
              style={{ flex: 1, padding: 8, fontSize: 13, border: 'none', background: pal.bg, borderRadius: 8 }}>
              {LF_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <select value={item.loc || 'pantry'} onChange={(e) => onChange({ loc: e.target.value })}
              style={{ flex: 1, padding: 8, fontSize: 13, border: 'none', background: pal.bg, borderRadius: 8 }}>
              <option value="fridge">Nevera</option>
              <option value="freezer">Congelador</option>
              <option value="pantry">Despensa</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: pal.inkSoft, flex: 1 }}>
              Caduca en (días)
              {item.expires == null && <span style={{ marginLeft: 6, color: pal.inkFaint, fontStyle: 'italic' }}>— sin caducidad</span>}
            </span>
            <input type="number" inputMode="numeric" value={item.expires ?? ''}
              onChange={(e) => onChange({ expires: e.target.value === '' ? null : Number(e.target.value) })}
              placeholder="—"
              style={{ width: 80, padding: 8, fontSize: 13, border: 'none', background: pal.bg, borderRadius: 8, textAlign: 'right' }} />
          </div>
        </div>
      )}
    </div>
  );
};

const TypeBtn = ({ pal, active, onClick, children }) => (
  <button onClick={onClick} style={{
    flex: 1, padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
    background: active ? pal.ink : pal.bg,
    color: active ? pal.bg : pal.inkSoft,
    border: `0.5px solid ${active ? pal.ink : pal.line}`,
    fontSize: 11, fontWeight: 600,
  }}>{children}</button>
);

const Field = ({ label, children }) => (
  <div style={{ marginBottom: 14 }}>
    <Label>{label}</Label>
    {children}
  </div>
);
const Label = ({ children }) => {
  const { pal } = useLF();
  return <div style={{ fontSize: 11, fontWeight: 700, color: pal.inkSoft, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>{children}</div>;
};
const inputStyle = (pal) => ({
  width: '100%', padding: '12px 14px', fontSize: 15,
  background: pal.surface, border: `1px solid ${pal.line}`,
  borderRadius: 10, color: pal.ink, outline: 'none',
});
