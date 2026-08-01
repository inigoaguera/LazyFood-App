import React, { useEffect, useState } from 'react';
import { useLF } from '../components/ctx.js';
import { toast } from '../components/base.jsx';
import {
  create as resourceCreate, patch as resourcePatch, remove as resourceRemove,
} from '../api/resources.js';
import { syncHousehold } from '../api/sync.js';
import { localISODate } from '../util/date.js';
import { useCategories } from '../util/categories.js';
import { expenseLines, makeLine, linesTotal } from '../util/expenseLines.js';

// Modal full-screen para añadir / editar / borrar una compra.
//
// Las líneas de productos son el REGISTRO de la compra (snapshot guardado en el
// propio gasto), no el inventario. Editarlas aquí no añade, cambia ni borra nada
// de la nevera: el ticket queda como documento histórico aunque los alimentos ya
// se hayan consumido.
export default function ExpenseEditor({ expense, linkedItems = [], defaultDate, hid, onClose, onSaved }) {
  const { pal, fonts } = useLF();
  const allCategories = useCategories(hid);
  const editing = !!expense?.id;
  const [date, setDate] = useState(expense?.date || defaultDate || localISODate());
  const [store, setStore] = useState(expense?.store || '');
  const [amount, setAmount] = useState(expense?.amount != null ? String(expense.amount) : '');
  const [saved, setSaved] = useState(expense?.savedOnDiscounts != null ? String(expense.savedOnDiscounts) : '');
  const [lines, setLines] = useState(() => expenseLines(expense, linkedItems).map((l) => makeLine(l)));
  const [busy, setBusy] = useState(false);

  // Gastos antiguos (anteriores al snapshot) sólo tienen los items vivos vinculados.
  // Si llegan por sync después de abrir el editor, los reflejamos. Al guardar
  // quedan congelados en el propio gasto y ya no dependen del inventario.
  const legacy = !Array.isArray(expense?.items);
  useEffect(() => {
    if (legacy && lines.length === 0 && linkedItems.length > 0) {
      setLines(linkedItems.map((it) => makeLine(it)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedItems.length]);

  const itemsSum = linesTotal(lines);
  const total = amount !== '' ? Number(amount) : itemsSum;

  const addLine = () => setLines((xs) => [...xs, makeLine({ name: '', cat: 'otros', qty: 1, unit: 'uds' })]);
  const updateLine = (id, patch) => setLines((xs) => xs.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const removeLine = (id) => setLines((xs) => xs.filter((l) => l.id !== id));

  const save = async () => {
    if (!store.trim()) { toast('Pon dónde compraste', 'error'); return; }
    // 0 es un total válido: una compra pagada entera con vale o puntos. El
    // `!total` de antes lo rechazaba junto con el vacío.
    if (!Number.isFinite(total) || total < 0) { toast('Pon un total válido', 'error'); return; }
    setBusy(true);
    try {
      const payload = {
        date, store: store.trim(),
        amount: Number(total),
        cat: 'super',
        savedOnDiscounts: saved === '' ? null : Number(saved),
        // Siempre mandamos las líneas: es lo que conserva el desglose para siempre.
        items: lines.filter((l) => l.name?.trim()).map((l) => makeLine(l)),
      };
      if (editing) {
        await resourcePatch('expenses', hid, expense.id, payload);
      } else {
        await resourceCreate('expenses', hid, payload);
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
    if (!confirm('¿Borrar este gasto? Se pierde el registro de la compra y su desglose. Los alimentos siguen en el inventario.')) return;
    try {
      await resourceRemove('expenses', hid, expense.id);
      toast('Gasto borrado');
      await syncHousehold(hid);
      onSaved?.();
    } catch (e) { toast(e?.message || 'Error', 'error'); }
  };

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
            <Label>Productos comprados ({lines.length})</Label>
            <button onClick={addLine} style={{
              background: pal.primarySoft, color: pal.primary,
              border: 'none', borderRadius: 10, padding: '6px 12px',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>+ Añadir</button>
          </div>
          <div style={{ fontSize: 11, color: pal.inkFaint, marginBottom: 8, lineHeight: 1.4 }}>
            Es el desglose del ticket y se guarda para siempre. Editarlo aquí no cambia tu inventario:
            aunque te comas los alimentos, la compra sigue registrada con su precio y categoría.
          </div>
          {legacy && lines.length > 0 && (
            <div style={{
              fontSize: 11, color: pal.inkSoft, marginBottom: 8, lineHeight: 1.4,
              background: pal.primarySoft, borderRadius: 10, padding: 10,
            }}>
              Esta compra es anterior a los tickets permanentes. Al guardar, este desglose queda
              fijado y ya no se perderá al consumir los alimentos.
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {lines.map((l) => (
              <LineEditor key={l.id} line={l} pal={pal} allCategories={allCategories}
                onChange={(patch) => updateLine(l.id, patch)}
                onRemove={() => removeLine(l.id)} />
            ))}
            {lines.length === 0 && (
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

const LineEditor = ({ line, pal, allCategories, onChange, onRemove }) => {
  const [open, setOpen] = useState(!line.name);
  const catLabel = allCategories.find((c) => c.id === line.cat)?.label
    || (line.cat === 'otros' ? 'Otros' : line.cat);
  return (
    <div style={{
      background: pal.surface, borderRadius: 10, border: `0.5px solid ${pal.line}`, overflow: 'hidden',
    }}>
      <div onClick={() => setOpen((x) => !x)} style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: 10, cursor: 'pointer',
      }}>
        <span style={{ fontSize: 20, width: 28, textAlign: 'center' }}>{line.emoji || '🛒'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: pal.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{line.name || 'Sin nombre'}</div>
          <div style={{ fontSize: 11, color: pal.inkSoft }}>
            {line.qty || 1} {line.unit || 'uds'}
            {line.price != null ? ` · ${Number(line.price).toFixed(2)}€` : ''}
            {catLabel ? ` · ${catLabel}` : ''}
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
            <input value={line.emoji || ''} onChange={(e) => onChange({ emoji: e.target.value })}
              style={{ width: 44, padding: 8, fontSize: 18, textAlign: 'center', border: 'none', background: pal.bg, borderRadius: 8 }} />
            <input value={line.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Producto"
              style={{ flex: 1, padding: 8, fontSize: 13, border: 'none', background: pal.bg, borderRadius: 8 }} />
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <input type="number" inputMode="decimal" value={line.qty ?? ''}
              onChange={(e) => onChange({ qty: e.target.value === '' ? 1 : Number(e.target.value) })}
              placeholder="1"
              style={{ width: 60, padding: 8, fontSize: 13, border: 'none', background: pal.bg, borderRadius: 8, textAlign: 'center' }} />
            <input value={line.unit || ''} onChange={(e) => onChange({ unit: e.target.value })}
              placeholder="uds"
              style={{ width: 80, padding: 8, fontSize: 13, border: 'none', background: pal.bg, borderRadius: 8, textAlign: 'center' }} />
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center',
              background: pal.bg, borderRadius: 8, paddingRight: 8,
            }}>
              <input type="number" inputMode="decimal" value={line.price ?? ''}
                onChange={(e) => onChange({ price: e.target.value === '' ? null : Number(e.target.value) })}
                placeholder="0.00"
                style={{ flex: 1, padding: 8, fontSize: 13, border: 'none', background: 'transparent', outline: 'none', textAlign: 'right' }} />
              <span style={{ fontSize: 13, color: pal.inkSoft, fontWeight: 600 }}>€</span>
            </div>
          </div>
          <div style={{ marginTop: 6 }}>
            <select value={line.cat || 'otros'} onChange={(e) => onChange({ cat: e.target.value })}
              style={{ width: '100%', padding: 8, fontSize: 13, border: 'none', background: pal.bg, borderRadius: 8 }}>
              {allCategories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              <option value="otros">Otros</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};

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
