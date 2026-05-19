import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db.js';
import { useLF } from '../components/ctx.js';
import { Screen, Header, IconBtn, Card, Chip } from '../components/base.jsx';
import ExpenseCalendar from './ExpenseCalendar.jsx';
import ExpenseEditor from './ExpenseEditor.jsx';
import { localISODate } from '../util/date.js';
import { useCategories } from '../util/categories.js';

// Categorías virtuales para el desglose cuando un item no tiene cat o falta info.
const FALLBACK_CATS = {
  super: { label: 'Supermercado', color: '#A8C9A0' },
  otros: { label: 'Otros', color: '#C4B8A5' },
};
function makeCatInfo(allCategories) {
  return (cat) => allCategories.find((c) => c.id === cat) || FALLBACK_CATS[cat] || { label: cat, color: '#C4B8A5' };
}

// Periodos de filtro
const PERIODS = [
  { id: 'today', label: 'Hoy' },
  { id: 'week',  label: 'Semana' },
  { id: 'month', label: 'Este mes' },
  { id: 'year',  label: 'Año' },
];
// Tipos de desglose
const BREAKDOWNS = [
  { id: 'category', label: 'Por categoría' },
  { id: 'store',    label: 'Supermercado' },
  { id: 'savings',  label: 'Descuentos' },
];

export default function Expenses({ onBack }) {
  const { pal, fonts, settings, currentHouseholdMeta } = useLF();
  const hid = currentHouseholdMeta?.id;
  const allCategories = useCategories(hid);
  const catInfo = makeCatInfo(allCategories);
  const chartVariant = settings.chartVariant || 'donut';
  const budget = currentHouseholdMeta?.budget || 400;

  const [period, setPeriod] = useState('month');
  const [breakdown, setBreakdown] = useState('category');
  const [showCalendar, setShowCalendar] = useState(false);
  const [editor, setEditor] = useState(null);

  const expenses = useLiveQuery(
    () => hid ? db.expenses.where({ householdId: hid }).toArray() : Promise.resolve([]),
    [hid], []
  );
  const allItems = useLiveQuery(
    () => hid ? db.items.where({ householdId: hid }).toArray() : Promise.resolve([]),
    [hid], []
  );

  // Mapa expense_id -> [items vinculados]
  const itemsByExpense = useMemo(() => {
    const map = {};
    for (const it of allItems) {
      if (!it.expenseId) continue;
      (map[it.expenseId] = map[it.expenseId] || []).push(it);
    }
    return map;
  }, [allItems]);

  const filtered = useMemo(() => filterByPeriod(expenses, period), [expenses, period]);
  const monthTotal = filtered.reduce((a, b) => a + (Number(b.amount) || 0), 0);
  const savedOnDiscounts = filtered.reduce((a, b) => a + (Number(b.savedOnDiscounts) || 0), 0);
  const pct = Math.min(100, Math.round((monthTotal / budget) * 100));

  return (
    <Screen>
      <Header big title="Gastos" subtitle={periodLabel(period)}
        left={<IconBtn icon="chevronLeft" onClick={onBack} />}
        right={<IconBtn icon="calendar" tone="soft" onClick={() => setShowCalendar(true)} />} />

      {/* Resumen del periodo */}
      <div style={{ padding: '4px 20px 18px' }}>
        <Card style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <div style={{ fontFamily: fonts.display, fontSize: 46, fontWeight: 800, color: pal.ink, lineHeight: 1, letterSpacing: '-0.03em' }}>
              {monthTotal.toFixed(2)}<span style={{ fontSize: 22, color: pal.inkSoft }}>€</span>
            </div>
            {period === 'month' && (
              <div style={{ marginBottom: 4, fontSize: 12, color: pct > 85 ? pal.danger : pal.primary, fontWeight: 700 }}>
                {pct}% de {budget}€
              </div>
            )}
          </div>
          {period === 'month' && (
            <>
              <div style={{ marginTop: 12, height: 8, borderRadius: 4, background: pal.line, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: pct > 85 ? pal.danger : pal.primary, borderRadius: 4 }}/>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: pal.inkSoft }}>
                <span>{pct < 85 ? 'Vas bien' : 'Casi en el límite'}</span>
                <span>Quedan {(budget - monthTotal).toFixed(2)} €</span>
              </div>
            </>
          )}
          {filtered.length === 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: pal.inkFaint }}>
              Aún no hay gastos en este periodo.
            </div>
          )}
        </Card>
      </div>

      {/* Chips de tiempo */}
      <div style={{ padding: '0 20px 8px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: pal.inkFaint, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>
          Periodo
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
          {PERIODS.map((p) => (
            <Chip key={p.id} label={p.label} active={period === p.id} onClick={() => setPeriod(p.id)} />
          ))}
        </div>
      </div>

      {/* Chips de desglose */}
      <div style={{ padding: '8px 20px 12px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: pal.inkFaint, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>
          Ver
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
          {BREAKDOWNS.map((b) => (
            <Chip key={b.id} label={b.label} active={breakdown === b.id} onClick={() => setBreakdown(b.id)} />
          ))}
        </div>
      </div>

      {/* Tarjeta del desglose seleccionado */}
      <div style={{ padding: '0 20px 18px' }}>
        {breakdown === 'category' && <CategoryBreakdown expenses={filtered} itemsByExpense={itemsByExpense} chartVariant={chartVariant} catInfo={catInfo} />}
        {breakdown === 'store' && <StoreBreakdown expenses={filtered} />}
        {breakdown === 'savings' && <SavingsBreakdown expenses={filtered} savedTotal={savedOnDiscounts} />}
      </div>

      {/* Lista de últimos gastos */}
      <div style={{ padding: '0 20px 24px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: pal.inkSoft, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 10 }}>
          Compras del periodo ({filtered.length})
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
            .slice(0, 10)
            .map((e) => {
              const linked = itemsByExpense[e.id] || [];
              return (
                <button key={e.id} onClick={() => setEditor({ expense: e })} style={{
                  textAlign: 'left', background: pal.surface,
                  border: `0.5px solid ${pal.line}`, borderRadius: 14,
                  padding: '12px 14px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: pal.ink }}>{e.store || 'Compra'}</div>
                    <div style={{ fontSize: 11, color: pal.inkSoft, marginTop: 2 }}>
                      {formatDate(e.date)}{linked.length ? ` · ${linked.length} items` : ''}
                    </div>
                  </div>
                  <div style={{ fontFamily: fonts.display, fontSize: 16, fontWeight: 700, color: pal.ink }}>
                    {Number(e.amount).toFixed(2)} €
                  </div>
                </button>
              );
            })}
          {filtered.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: pal.inkFaint, fontSize: 13 }}>
              No hay compras en este periodo. Pulsa el calendario arriba 👆 para añadir una.
            </div>
          )}
        </div>
      </div>

      {showCalendar && (
        <ExpenseCalendar
          expenses={expenses}
          itemsByExpense={itemsByExpense}
          hid={hid}
          onClose={() => setShowCalendar(false)} />
      )}
      {editor && (
        <ExpenseEditor
          expense={editor.expense}
          linkedItems={editor.expense ? (itemsByExpense[editor.expense.id] || []) : []}
          hid={hid}
          onClose={() => setEditor(null)}
          onSaved={() => setEditor(null)} />
      )}
    </Screen>
  );
}

// ─── Filtros de tiempo ───────────────────────────────────────────────
function filterByPeriod(expenses, period) {
  const now = new Date();
  const today = localISODate(now);
  const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const sw = localISODate(startOfWeek);
  const yearStart = `${now.getFullYear()}-01-01`;
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  return expenses.filter((e) => {
    if (!e.date) return false;
    if (period === 'today') return e.date === today;
    if (period === 'week') return e.date >= sw;
    if (period === 'month') return e.date.startsWith(monthStr);
    if (period === 'year') return e.date >= yearStart;
    return true;
  });
}
function periodLabel(period) {
  const d = new Date();
  if (period === 'today') return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  if (period === 'week') return 'Esta semana';
  if (period === 'year') return `Año ${d.getFullYear()}`;
  return ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][d.getMonth()] + ' ' + d.getFullYear();
}
function formatDate(s) {
  if (!s) return '—';
  try {
    return new Date(s + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  } catch { return s; }
}

// ─── Breakdowns ──────────────────────────────────────────────────────

const CategoryBreakdown = ({ expenses, itemsByExpense, chartVariant, catInfo }) => {
  const { pal } = useLF();
  // Agregamos por categoría usando items VINCULADOS a las compras del periodo.
  // Si la suma de items no llega al total del expense, el resto va a "Otros"
  // para que el desglose siempre cuadre con el número grande de arriba.
  const byCat = {};
  for (const e of expenses) {
    const total = Number(e.amount) || 0;
    const linked = itemsByExpense?.[e.id] || [];
    if (linked.length > 0) {
      let itemsSum = 0;
      for (const it of linked) {
        const c = it.cat || 'otros';
        const price = Number(it.price) || 0;
        byCat[c] = (byCat[c] || 0) + price;
        itemsSum += price;
      }
      if (total > itemsSum + 0.01) {
        byCat.otros = (byCat.otros || 0) + (total - itemsSum);
      }
    } else {
      const c = e.cat && e.cat !== 'super' ? e.cat : 'otros';
      byCat[c] = (byCat[c] || 0) + total;
    }
  }
  const arr = Object.entries(byCat)
    .map(([cat, amount]) => {
      const info = catInfo(cat);
      return { cat, amount, label: info.label, color: info.color };
    })
    .filter((x) => x.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  if (arr.length === 0) return <Card><Empty pal={pal} text="Aún sin desglose por categoría" /></Card>;
  return (
    <Card>
      <Title>Por categoría</Title>
      {chartVariant === 'donut' && <DonutChart data={arr} />}
      {chartVariant === 'bars' && <BarChart data={arr} />}
      {chartVariant === 'treemap' && <TreemapChart data={arr} />}
    </Card>
  );
};

const StoreBreakdown = ({ expenses }) => {
  const { pal, fonts } = useLF();
  const byStore = {};
  for (const e of expenses) {
    const k = e.store || 'Sin nombre';
    byStore[k] = (byStore[k] || 0) + (Number(e.amount) || 0);
  }
  const arr = Object.entries(byStore).map(([k, v]) => ({ key: k, amount: v })).sort((a, b) => b.amount - a.amount);
  if (arr.length === 0) return <Card><Empty pal={pal} text="Aún sin compras registradas" /></Card>;
  const max = arr[0].amount || 1;
  return (
    <Card>
      <Title>Supermercados</Title>
      {arr.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < arr.length - 1 ? `0.5px solid ${pal.line}` : 'none' }}>
          <span style={{
            width: 28, height: 28, borderRadius: 14, background: pal.bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: pal.inkSoft,
          }}>{i + 1}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: pal.ink }}>{s.key}</div>
            <div style={{ height: 4, marginTop: 4, background: pal.line, borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${(s.amount / max) * 100}%`, height: '100%', background: pal.primary }}/>
            </div>
          </div>
          <div style={{ fontFamily: fonts.display, fontWeight: 700, color: pal.ink, fontSize: 14 }}>{s.amount.toFixed(2)} €</div>
        </div>
      ))}
    </Card>
  );
};

const SavingsBreakdown = ({ expenses, savedTotal }) => {
  const { pal, fonts } = useLF();
  const withSavings = expenses.filter((e) => Number(e.savedOnDiscounts) > 0).sort((a, b) => Number(b.savedOnDiscounts) - Number(a.savedOnDiscounts));
  if (savedTotal === 0) return <Card><Empty pal={pal} text="No has aprovechado ofertas en este periodo" /></Card>;
  return (
    <>
      <div style={{
        padding: 14, background: pal.primary, color: '#fff',
        borderRadius: 16, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10,
      }}>
        <span style={{ fontSize: 28 }}>💸</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, opacity: 0.85 }}>Ahorrado en este periodo</div>
          <div style={{ fontFamily: fonts.display, fontSize: 22, fontWeight: 700 }}>{savedTotal.toFixed(2)} €</div>
        </div>
        <span style={{ fontSize: 11, opacity: 0.9 }}>con ofertas</span>
      </div>
      {withSavings.length > 0 && (
        <Card>
          <Title>Compras con ahorro</Title>
          {withSavings.map((e, i) => (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < withSavings.length - 1 ? `0.5px solid ${pal.line}` : 'none' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: pal.ink }}>{e.store || 'Compra'}</div>
                <div style={{ fontSize: 11, color: pal.inkSoft, marginTop: 2 }}>{formatDate(e.date)} · {Number(e.amount).toFixed(2)} €</div>
              </div>
              <div style={{ fontFamily: fonts.display, fontSize: 14, fontWeight: 700, color: pal.primary }}>
                −{Number(e.savedOnDiscounts).toFixed(2)} €
              </div>
            </div>
          ))}
        </Card>
      )}
    </>
  );
};

const Title = ({ children }) => {
  const { pal } = useLF();
  return <div style={{ fontSize: 12, fontWeight: 700, color: pal.inkSoft, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 12 }}>{children}</div>;
};
const Empty = ({ pal, text }) => (
  <div style={{ padding: '14px 4px', textAlign: 'center', fontSize: 13, color: pal.inkFaint }}>{text}</div>
);

// ─── Charts (igual que antes pero con datos dinámicos) ──────────────

const DonutChart = ({ data }) => {
  const { pal, fonts } = useLF();
  const total = data.reduce((a, b) => a + b.amount, 0);
  let acc = 0;
  const R = 55, C = 2 * Math.PI * R;
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
      <svg width={140} height={140} viewBox="0 0 140 140">
        {data.map((c, i) => {
          const frac = c.amount / total;
          const len = frac * C;
          const off = -acc * C;
          acc += frac;
          return <circle key={i} cx="70" cy="70" r={R} fill="none"
            stroke={c.color} strokeWidth="22"
            strokeDasharray={`${len} ${C}`} strokeDashoffset={off}
            transform="rotate(-90 70 70)" />;
        })}
        <text x="70" y="68" textAnchor="middle" fontFamily={fonts.display} fontSize="22" fontWeight="800" fill={pal.ink}>{total.toFixed(0)}€</text>
        <text x="70" y="84" textAnchor="middle" fontSize="9" fill={pal.inkSoft}>total</text>
      </svg>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.slice(0, 5).map((c, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <span style={{ width: 10, height: 10, borderRadius: 5, background: c.color }}/>
            <span style={{ flex: 1, color: pal.ink }}>{c.label}</span>
            <span style={{ color: pal.inkSoft, fontWeight: 600 }}>{c.amount.toFixed(0)}€</span>
          </div>
        ))}
      </div>
    </div>
  );
};
const BarChart = ({ data }) => {
  const { pal, fonts } = useLF();
  const max = Math.max(...data.map((c) => c.amount));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.map((c, i) => (
        <div key={i}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: pal.inkSoft, marginBottom: 4 }}>
            <span>{c.label}</span>
            <span style={{ fontFamily: fonts.display, fontWeight: 700, color: pal.ink }}>{c.amount.toFixed(2)} €</span>
          </div>
          <div style={{ height: 10, background: pal.line, borderRadius: 5, overflow: 'hidden' }}>
            <div style={{ width: `${(c.amount / max) * 100}%`, height: '100%', background: c.color, borderRadius: 5 }}/>
          </div>
        </div>
      ))}
    </div>
  );
};
const TreemapChart = ({ data }) => {
  const { pal, fonts } = useLF();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gridTemplateRows: '80px 60px 60px', gap: 4, height: 200 }}>
      {data.slice(0, 6).map((c, i) => {
        const span = i === 0 ? { gridRow: 'span 2' } : {};
        return (
          <div key={i} style={{
            background: c.color, borderRadius: 10, padding: 10,
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between', ...span,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: pal.ink, opacity: 0.7 }}>{c.label}</div>
            <div style={{ fontFamily: fonts.display, fontSize: 16, fontWeight: 800, color: pal.ink }}>{c.amount.toFixed(0)}€</div>
          </div>
        );
      })}
    </div>
  );
};
