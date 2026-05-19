import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db.js';
import { useLF } from '../components/ctx.js';
import { Header, IconBtn, toast } from '../components/base.jsx';
import { LF_SHADOWS } from '../tokens/palettes.js';
import { RecipeThumb } from '../data/recipeThumbs.jsx';
import { autoPlanMenu, proxyConfigured } from '../api.js';
import { setMenuSlot as cloudSetMenuSlot } from '../api/resources.js';

const DAYS = [
  { id: 'mon', short: 'L', long: 'Lunes' },
  { id: 'tue', short: 'M', long: 'Martes' },
  { id: 'wed', short: 'X', long: 'Miércoles' },
  { id: 'thu', short: 'J', long: 'Jueves' },
  { id: 'fri', short: 'V', long: 'Viernes' },
  { id: 'sat', short: 'S', long: 'Sábado' },
  { id: 'sun', short: 'D', long: 'Domingo' },
];
const MEALS = [
  { id: 'lunch', label: 'Comida', icon: '☀️' },
  { id: 'dinner', label: 'Cena', icon: '🌙' },
];

export default function Menu({ onBack, onOpenRecipe }) {
  const { pal, currentHouseholdMeta } = useLF();
  const hid = currentHouseholdMeta?.id;
  const planRows = useLiveQuery(
    () => hid ? db.menuPlan.where({ householdId: hid }).toArray() : Promise.resolve([]),
    [hid], []
  );
  const recipes = useLiveQuery(
    () => hid ? db.recipes.where({ householdId: hid }).toArray() : Promise.resolve([]),
    [hid], []
  );
  const items = useLiveQuery(
    () => hid ? db.items.where({ householdId: hid }).toArray() : Promise.resolve([]),
    [hid], []
  );
  const [picker, setPicker] = useState(null);
  const [actions, setActions] = useState(null);
  const [busy, setBusy] = useState(false);

  const plan = Object.fromEntries(planRows.map((r) => [r.slot, r.recipeId]));
  const recipesById = Object.fromEntries(recipes.map((r) => [r.id, r]));

  const totalSlots = DAYS.length * MEALS.length;
  const filled = Object.values(plan).filter(Boolean).length;
  const todayId = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()];

  const setSlot = async (day, meal, recipeId) => {
    if (!hid) return;
    const slot = `${day}-${meal}`;
    try { await cloudSetMenuSlot(hid, slot, recipeId || null); }
    catch (e) { toast(e?.message || 'Error', 'error'); }
  };

  const handleAuto = async () => {
    if (!hid) return;
    if (!proxyConfigured()) {
      for (const d of DAYS) {
        for (const m of MEALS) {
          const slot = `${d.id}-${m.id}`;
          if (!plan[slot]) {
            const r = recipes[Math.floor(Math.random() * recipes.length)];
            if (r) await cloudSetMenuSlot(hid, slot, r.id);
          }
        }
      }
      toast('Menú generado (modo local)');
      return;
    }
    setBusy(true);
    try {
      const inv = items.map((it) => {
        const qty = it.type === 'continuous' ? `${it.fill}%` : `${it.qty} ${it.unit}`;
        return `- ${it.name}: ${qty}${it.expires <= 5 ? ' ⚠' : ''}`;
      }).join('\n');
      const result = await autoPlanMenu({
        inventory: inv, recipes, currentPlan: plan,
        days: DAYS.map((d) => d.id), meals: MEALS.map((m) => m.id),
      });
      const newPlan = result?.plan || {};
      let count = 0;
      for (const [slot, rid] of Object.entries(newPlan)) {
        if (!plan[slot] && recipesById[rid]) {
          await cloudSetMenuSlot(hid, slot, rid);
          count++;
        }
      }
      toast(count > 0 ? `${count} comidas añadidas` : 'Menú al día ✓');
    } catch (e) {
      toast('No he podido generar el menú', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ height: '100%', background: pal.bg, display: 'flex', flexDirection: 'column' }}>
      <Header
        title="Menú semanal"
        subtitle={`${filled} de ${totalSlots} comidas planificadas`}
        left={<IconBtn icon="arrowLeft" onClick={onBack} />}
        right={<IconBtn icon="sparkle" onClick={handleAuto} />} />

      <WeekBar plan={plan} todayId={todayId} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 100px' }}>
        {DAYS.map((d) => (
          <DayCard
            key={d.id}
            day={d}
            isToday={d.id === todayId}
            plan={plan}
            recipesById={recipesById}
            onAssign={(meal) => setPicker({ day: d.id, meal })}
            onSlotMenu={(meal) => setActions({ day: d.id, meal })}
          />
        ))}
        <div style={{
          marginTop: 16, padding: 14, borderRadius: 14,
          background: pal.primarySoft, color: pal.primary,
          fontSize: 12, lineHeight: 1.5, textAlign: 'center',
        }}>
          {busy ? 'Pensando un menú con tu inventario…' : <>💡 Toca <strong>✨</strong> arriba para auto-planificar la semana con tu inventario.</>}
        </div>
      </div>

      {picker && (
        <RecipePickerSheet
          slot={picker} recipes={recipes} recipesById={recipesById}
          currentId={plan[`${picker.day}-${picker.meal}`]}
          onClose={() => setPicker(null)}
          onPick={(rid) => { setSlot(picker.day, picker.meal, rid); setPicker(null); }}
        />
      )}

      {actions && (
        <SlotActionsSheet
          slot={actions}
          recipe={recipesById[plan[`${actions.day}-${actions.meal}`]]}
          onClose={() => setActions(null)}
          onView={(rid) => { setActions(null); onOpenRecipe?.(rid); }}
          onReplace={() => { const s = actions; setActions(null); setPicker(s); }}
          onRemove={() => { setSlot(actions.day, actions.meal, null); setActions(null); }}
        />
      )}
    </div>
  );
}

const WeekBar = ({ plan, todayId }) => {
  const { pal } = useLF();
  return (
    <div style={{
      margin: '4px 16px 12px', padding: '12px 14px',
      background: pal.surface, borderRadius: 14,
      border: `0.5px solid ${pal.line}`, boxShadow: LF_SHADOWS.sm,
      display: 'flex', justifyContent: 'space-between', alignItems: 'stretch', gap: 6,
    }}>
      {DAYS.map((d) => {
        const lunch = !!plan[`${d.id}-lunch`];
        const dinner = !!plan[`${d.id}-dinner`];
        const isToday = d.id === todayId;
        return (
          <div key={d.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: isToday ? pal.primary : pal.inkFaint,
              letterSpacing: '0.04em',
            }}>{d.short}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%' }}>
              <div style={{ height: 6, borderRadius: 3, background: lunch ? pal.primary : pal.line }}/>
              <div style={{ height: 6, borderRadius: 3, background: dinner ? pal.accent : pal.line }}/>
            </div>
            {isToday && <div style={{ width: 4, height: 4, borderRadius: 2, background: pal.primary }}/>}
          </div>
        );
      })}
    </div>
  );
};

const DayCard = ({ day, isToday, plan, recipesById, onAssign, onSlotMenu }) => {
  const { pal, fonts } = useLF();
  return (
    <div style={{
      marginBottom: 10, background: pal.surface, borderRadius: 16,
      border: isToday ? `1.5px solid ${pal.primary}` : `0.5px solid ${pal.line}`,
      boxShadow: LF_SHADOWS.sm, overflow: 'hidden',
    }}>
      <div style={{
        padding: '10px 14px',
        background: isToday ? pal.primarySoft : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{
            fontFamily: fonts.display, fontWeight: 700, fontSize: 16,
            color: isToday ? pal.primary : pal.ink,
          }}>{day.long}</span>
          {isToday && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 7px',
              borderRadius: 8, background: pal.primary, color: '#fff',
            }}>HOY</span>
          )}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: pal.line }}>
        {MEALS.map((m) => {
          const rid = plan[`${day.id}-${m.id}`];
          const recipe = rid ? recipesById[rid] : null;
          return (
            <MealSlot
              key={m.id} meal={m} recipe={recipe}
              onClick={() => recipe ? onSlotMenu(m.id) : onAssign(m.id)}
            />
          );
        })}
      </div>
    </div>
  );
};

const MealSlot = ({ meal, recipe, onClick }) => {
  const { pal } = useLF();
  return (
    <button onClick={onClick} style={{
      background: pal.surface, border: 'none', cursor: 'pointer',
      padding: 0, textAlign: 'left', minHeight: 96,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        padding: '8px 12px 4px', display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 11, fontWeight: 700, color: pal.inkFaint,
        letterSpacing: '0.06em', textTransform: 'uppercase',
      }}>
        <span style={{ fontSize: 12 }}>{meal.icon}</span>
        <span>{meal.label}</span>
      </div>
      {recipe ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'stretch' }}>
          <div style={{ width: 56, flexShrink: 0 }}>
            <RecipeThumb img={recipe.img} height={64} />
          </div>
          <div style={{ flex: 1, padding: '8px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
            <div style={{
              fontSize: 12, fontWeight: 700, color: pal.ink,
              lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}>{recipe.name}</div>
            <div style={{ fontSize: 10, color: pal.inkFaint, marginTop: 2 }}>⏱ {recipe.time}m</div>
          </div>
        </div>
      ) : (
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 6, color: pal.inkFaint, fontSize: 12, fontWeight: 600,
          padding: '8px 12px',
        }}>
          <div style={{
            width: 22, height: 22, borderRadius: 11,
            background: pal.bg, border: `1px dashed ${pal.lineStrong}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, color: pal.inkSoft, lineHeight: 1,
          }}>+</div>
          <span>Asignar receta</span>
        </div>
      )}
    </button>
  );
};

const RecipePickerSheet = ({ slot, recipes, recipesById, currentId, onClose, onPick }) => {
  const { pal, fonts } = useLF();
  const [query, setQuery] = useState('');
  const groupLabels = { yours: 'Tus recetas', effortless: 'Sin esfuerzo', chef: 'Modo chef', oneOff: 'Te falta 1 ingrediente' };

  const dayLong = (DAYS.find((d) => d.id === slot.day) || {}).long;
  const mealLabel = (MEALS.find((m) => m.id === slot.meal) || {}).label;

  const filterRecipe = (r) => !query || r.name.toLowerCase().includes(query.toLowerCase());
  const groups = recipes.reduce((acc, r) => {
    (acc[r.group] = acc[r.group] || []).push(r); return acc;
  }, {});

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 50,
      background: 'rgba(20,25,18,0.45)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-end',
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxHeight: '85%',
        background: pal.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        animation: 'slideUp .28s cubic-bezier(.3,.7,.4,1)',
      }}>
        <div style={{ padding: '10px 0 4px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: pal.lineStrong }}/>
        </div>
        <div style={{ padding: '4px 20px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: pal.inkSoft, fontSize: 14, cursor: 'pointer', padding: 0 }}>Cancelar</button>
          <div style={{ fontFamily: fonts.body, fontSize: 15, fontWeight: 600 }}>
            {dayLong} · {mealLabel}
          </div>
          <div style={{ width: 60 }}/>
        </div>
        <div style={{ padding: '0 20px 12px' }}>
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar receta…"
            style={{
              width: '100%', border: 'none',
              background: pal.surface, borderRadius: 12,
              padding: '12px 14px', fontSize: 14,
              color: pal.ink, boxShadow: LF_SHADOWS.sm, outline: 'none',
              borderBottom: `0.5px solid ${pal.line}`,
            }} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 32px' }}>
          {Object.entries(groups).map(([gKey, list]) => {
            const visible = list.filter(filterRecipe);
            if (!visible.length) return null;
            return (
              <div key={gKey} style={{ marginBottom: 18 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: pal.inkFaint,
                  letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8,
                }}>{groupLabels[gKey] || gKey}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {visible.map((r) => (
                    <PickerRow key={r.id} recipe={r}
                      selected={r.id === currentId}
                      onClick={() => onPick(r.id)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const PickerRow = ({ recipe, selected, onClick }) => {
  const { pal } = useLF();
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'stretch', gap: 0,
      background: pal.surface, borderRadius: 14,
      border: selected ? `1.5px solid ${pal.primary}` : `0.5px solid ${pal.line}`,
      boxShadow: LF_SHADOWS.sm, padding: 0, cursor: 'pointer',
      overflow: 'hidden', textAlign: 'left',
    }}>
      <div style={{ width: 70, flexShrink: 0 }}>
        <RecipeThumb img={recipe.img} height={70} />
      </div>
      <div style={{ flex: 1, padding: '10px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: pal.ink, lineHeight: 1.2 }}>
          {recipe.name}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 11, color: pal.inkSoft, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>🍳 {recipe.effort}</span>
          <span>⏱ {recipe.time}m</span>
        </div>
      </div>
      <div style={{
        width: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: selected ? pal.primary : pal.inkFaint,
      }}>{selected ? '✓' : '›'}</div>
    </button>
  );
};

const SlotActionsSheet = ({ slot, recipe, onClose, onView, onReplace, onRemove }) => {
  const { pal, fonts } = useLF();
  if (!recipe) return null;
  const dayLong = (DAYS.find((d) => d.id === slot.day) || {}).long;
  const mealLabel = (MEALS.find((m) => m.id === slot.meal) || {}).label;

  const Action = ({ icon, label, onClick, danger }) => (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 14,
      width: '100%', padding: '14px 18px',
      background: pal.surface, border: 'none', cursor: 'pointer',
      textAlign: 'left', fontSize: 15, fontWeight: 600,
      color: danger ? pal.danger : pal.ink,
      borderTop: `0.5px solid ${pal.line}`,
    }}>
      <span style={{ fontSize: 20, width: 24, textAlign: 'center' }}>{icon}</span>
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
        borderTopLeftRadius: 28, borderTopRightRadius: 28,
        overflow: 'hidden',
        animation: 'slideUp .28s cubic-bezier(.3,.7,.4,1)',
      }}>
        <div style={{ padding: '10px 0 4px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: pal.lineStrong }}/>
        </div>
        <div style={{ padding: '12px 20px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, overflow: 'hidden', flexShrink: 0 }}>
            <RecipeThumb img={recipe.img} height={56} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: pal.inkFaint, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {dayLong} · {mealLabel}
            </div>
            <div style={{ fontFamily: fonts.display, fontSize: 17, fontWeight: 700, color: pal.ink, marginTop: 2 }}>
              {recipe.name}
            </div>
          </div>
        </div>
        <Action icon="👁" label="Ver receta" onClick={() => onView(recipe.id)} />
        <Action icon="🔄" label="Cambiar receta" onClick={onReplace} />
        <Action icon="🗑" label="Quitar del menú" onClick={onRemove} danger />
        <div style={{ height: 16 }}/>
      </div>
    </div>
  );
};
