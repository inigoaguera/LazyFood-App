import React, { useState, useMemo } from 'react';
import { useLF } from '../components/ctx.js';
import { LF_SHADOWS } from '../tokens/palettes.js';
import LFIcon from '../icons/LFIcon.jsx';
import ExpenseEditor from './ExpenseEditor.jsx';
import { localISODate } from '../util/date.js';

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

// Modal full-screen con calendario mensual + lista de gastos por día.
export default function ExpenseCalendar({ expenses, itemsByExpense = {}, hid, onClose }) {
  const { pal, fonts } = useLF();
  const [cursor, setCursor] = useState(() => {
    const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState(null);
  const [editor, setEditor] = useState(null); // { expense?: ..., defaultDate? }

  // Mapa: 'YYYY-MM-DD' -> [expenses]
  const byDate = useMemo(() => {
    const map = {};
    for (const e of expenses) {
      if (!e.date) continue;
      (map[e.date] = map[e.date] || []).push(e);
    }
    return map;
  }, [expenses]);

  // Total del mes para el header
  const monthTotal = useMemo(() => {
    return expenses
      .filter((e) => {
        if (!e.date) return false;
        const [y, m] = e.date.split('-').map(Number);
        return y === cursor.y && m - 1 === cursor.m;
      })
      .reduce((a, b) => a + (Number(b.amount) || 0), 0);
  }, [expenses, cursor]);

  const days = useMemo(() => buildMonthGrid(cursor.y, cursor.m), [cursor]);
  const today = localISODate();

  const goPrev = () => setCursor((c) => c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 });
  const goNext = () => setCursor((c) => c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 });

  const selectedExpenses = selectedDate ? (byDate[selectedDate] || []) : [];

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 50,
      background: pal.bg,
      display: 'flex', flexDirection: 'column',
      animation: 'slideUp .28s cubic-bezier(.3,.7,.4,1)',
    }}>
      <div style={{
        padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `0.5px solid ${pal.line}`,
      }}>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: pal.inkSoft, fontSize: 14, cursor: 'pointer' }}>Cerrar</button>
        <div style={{ fontFamily: fonts.display, fontSize: 17, fontWeight: 700, color: pal.ink }}>
          Calendario
        </div>
        <button onClick={() => setEditor({ defaultDate: today })} style={{
          background: 'transparent', border: 'none',
          color: pal.primary, fontSize: 14, fontWeight: 700, cursor: 'pointer',
        }}>+ Nuevo</button>
      </div>

      <div style={{ padding: '12px 18px', borderBottom: `0.5px solid ${pal.line}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={goPrev} style={navBtn(pal)}>‹</button>
          <div style={{ fontFamily: fonts.display, fontSize: 18, fontWeight: 700, color: pal.ink, textAlign: 'center' }}>
            {MONTHS[cursor.m]} {cursor.y}
          </div>
          <button onClick={goNext} style={navBtn(pal)}>›</button>
        </div>
        <div style={{ marginTop: 4, textAlign: 'center', fontSize: 13, color: pal.inkSoft }}>
          Total mes: <strong style={{ color: pal.ink }}>{monthTotal.toFixed(2)} €</strong>
        </div>
      </div>

      <div style={{ padding: '8px 14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 6 }}>
          {WEEKDAYS.map((w) => (
            <div key={w} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: pal.inkFaint, letterSpacing: '0.05em' }}>{w}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {days.map((d, i) => {
            if (!d) return <div key={i} />;
            const dateStr = localISODate(d);
            const dayExpenses = byDate[dateStr] || [];
            const totalDay = dayExpenses.reduce((a, b) => a + (Number(b.amount) || 0), 0);
            const isToday = dateStr === today;
            const isSelected = dateStr === selectedDate;
            const has = dayExpenses.length > 0;
            return (
              <button key={i} onClick={() => setSelectedDate(dateStr)} style={{
                aspectRatio: '1', borderRadius: 10,
                background: isSelected ? pal.primary
                  : isToday ? pal.primarySoft
                  : has ? pal.surface : 'transparent',
                color: isSelected ? '#fff' : pal.ink,
                border: isToday && !isSelected ? `1px solid ${pal.primary}` : `0.5px solid ${has ? pal.line : 'transparent'}`,
                cursor: 'pointer', padding: 4,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
                fontSize: 12, fontWeight: isToday ? 700 : 500,
              }}>
                <span style={{ marginTop: 2 }}>{d.getDate()}</span>
                {has && (
                  <span style={{
                    fontSize: 9, marginTop: 'auto', opacity: 0.85,
                    color: isSelected ? '#fff' : pal.primary, fontWeight: 700,
                  }}>{totalDay.toFixed(0)}€</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', borderTop: `0.5px solid ${pal.line}` }}>
        {selectedDate ? (
          <DayDetail date={selectedDate} expenses={selectedExpenses}
            itemsByExpense={itemsByExpense}
            onAddNew={() => setEditor({ defaultDate: selectedDate })}
            onEdit={(exp) => setEditor({ expense: exp })} />
        ) : (
          <div style={{ padding: '20px 0', textAlign: 'center', color: pal.inkFaint, fontSize: 13 }}>
            Toca un día para ver o añadir compras.
          </div>
        )}
      </div>

      {editor && (
        <ExpenseEditor
          expense={editor.expense}
          linkedItems={editor.expense ? (itemsByExpense[editor.expense.id] || []) : []}
          defaultDate={editor.defaultDate}
          hid={hid}
          onClose={() => setEditor(null)}
          onSaved={() => { setEditor(null); }} />
      )}
    </div>
  );
}

const DayDetail = ({ date, expenses, itemsByExpense = {}, onAddNew, onEdit }) => {
  const { pal, fonts } = useLF();
  const total = expenses.reduce((a, b) => a + (Number(b.amount) || 0), 0);
  const niceDate = new Date(date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div style={{ fontFamily: fonts.display, fontSize: 16, fontWeight: 700, color: pal.ink, textTransform: 'capitalize' }}>{niceDate}</div>
          {total > 0 && (
            <div style={{ fontSize: 12, color: pal.inkSoft, marginTop: 2 }}>
              {expenses.length} compra{expenses.length === 1 ? '' : 's'} · {total.toFixed(2)} €
            </div>
          )}
        </div>
        <button onClick={onAddNew} style={{
          background: pal.primary, color: '#fff', border: 'none',
          borderRadius: 14, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
        }}>+ Compra</button>
      </div>

      {expenses.length === 0 ? (
        <div style={{
          padding: 20, textAlign: 'center', color: pal.inkFaint, fontSize: 13,
          background: pal.surface, borderRadius: 14, border: `0.5px dashed ${pal.lineStrong}`,
        }}>
          Sin compras este día
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {expenses.map((e) => (
            <ExpenseRow key={e.id} expense={e}
              linkedItems={itemsByExpense[e.id] || []}
              onClick={() => onEdit(e)} />
          ))}
        </div>
      )}
    </div>
  );
};

const ExpenseRow = ({ expense, linkedItems = [], onClick }) => {
  const { pal, fonts } = useLF();
  const items = linkedItems;
  const itemCount = items.length;
  return (
    <button onClick={onClick} style={{
      width: '100%', textAlign: 'left',
      background: pal.surface, border: `0.5px solid ${pal.line}`,
      borderRadius: 14, padding: 14, cursor: 'pointer',
      boxShadow: LF_SHADOWS.sm,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: fonts.display, fontSize: 16, fontWeight: 700, color: pal.ink }}>
            {expense.store || 'Sin nombre'}
          </div>
          <div style={{ fontSize: 11, color: pal.inkSoft, marginTop: 2 }}>
            {itemCount > 0 ? `${itemCount} producto${itemCount === 1 ? '' : 's'}` : 'sin desglose'}
            {expense.savedOnDiscounts > 0 && <span style={{ color: pal.primary, marginLeft: 6 }}>· ahorraste {Number(expense.savedOnDiscounts).toFixed(2)}€</span>}
          </div>
        </div>
        <div style={{ fontFamily: fonts.display, fontSize: 18, fontWeight: 800, color: pal.ink, flexShrink: 0 }}>
          {Number(expense.amount).toFixed(2)}€
        </div>
      </div>
      {itemCount > 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `0.5px solid ${pal.line}`, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {items.slice(0, 6).map((it, i) => (
            <span key={i} style={{
              fontSize: 11, padding: '3px 8px', borderRadius: 8,
              background: pal.bg, color: pal.inkSoft,
            }}>
              {it.emoji || '🛒'} {it.name}{it.price != null ? ` · ${Number(it.price).toFixed(2)}€` : ''}
            </span>
          ))}
          {items.length > 6 && (
            <span style={{ fontSize: 11, color: pal.inkFaint, padding: '3px 8px' }}>
              +{items.length - 6} más
            </span>
          )}
        </div>
      )}
    </button>
  );
};

const navBtn = (pal) => ({
  width: 36, height: 36, borderRadius: 18,
  background: pal.surface, border: `0.5px solid ${pal.line}`,
  fontSize: 22, fontWeight: 700, color: pal.ink, cursor: 'pointer',
});

// Construye una matriz de 6×7 con los días del mes (empezando lunes).
function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const firstDay = (first.getDay() + 6) % 7; // lunes = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid = new Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    grid.push(new Date(year, month, d));
  }
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}
