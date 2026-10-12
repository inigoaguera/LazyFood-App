import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db.js';
import { useLF } from '../components/ctx.js';
import { Header, IconBtn, toast } from '../components/base.jsx';
import { LF_SHADOWS } from '../tokens/palettes.js';
import { RecipeThumb } from '../data/recipeThumbs.jsx';
import { autoPlanMenu, proxyConfigured } from '../api.js';
import { setMenuSlot as cloudSetMenuSlot } from '../api/resources.js';
import { inventoryForPrompt } from '../util/aiInventory.js';
import { useBackClose } from '../util/nav.js';
import { t, tNodes, errMsg, weekdayShort, weekdayLong } from '../i18n/index.js';
import { groupLabel, mealLabel } from '../i18n/labels.js';

// Los ids (mon…sun, lunch/dinner) forman las claves de hueco `${día}-${comida}`
// que se guardan en la base de datos: no cambian. Los nombres se pintan con
// weekdayShort/Long (lunes = 0, en el mismo orden que DAYS) y mealLabel.
const DAYS = [
  { id: 'mon' }, { id: 'tue' }, { id: 'wed' }, { id: 'thu' },
  { id: 'fri' }, { id: 'sat' }, { id: 'sun' },
];
const MEALS = [
  { id: 'lunch', icon: '☀️' },
  { id: 'dinner', icon: '🌙' },
];
const dayShort = (id) => weekdayShort(DAYS.findIndex((d) => d.id === id));
const dayLong = (id) => {
  const i = DAYS.findIndex((d) => d.id === id);
  return i >= 0 ? weekdayLong(i) : '';
};

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
  useBackClose(!!picker, () => setPicker(null));
  useBackClose(!!actions, () => setActions(null));
  const [busy, setBusy] = useState(false);

  const recipesById = Object.fromEntries(recipes.map((r) => [r.id, r]));
  // Un slot cuya receta se borró se pintaba vacío pero seguía contando como
  // lleno, y el auto-plan no lo rellenaba porque lo veía ocupado. Se ignoran
  // las asignaciones cuya receta ya no existe.
  const plan = Object.fromEntries(
    planRows
      .filter((r) => r.recipeId && recipesById[r.recipeId])
      .map((r) => [r.slot, r.recipeId])
  );

  const totalSlots = DAYS.length * MEALS.length;
  const filled = Object.values(plan).filter(Boolean).length;
  const todayId = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()];

  const setSlot = async (day, meal, recipeId) => {
    if (!hid) return;
    const slot = `${day}-${meal}`;
    try { await cloudSetMenuSlot(hid, slot, recipeId || null); }
    catch (e) { toast(errMsg(e), 'error'); }
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
      toast(t('menu.localDone'));
      return;
    }
    setBusy(true);
    try {
      const inv = inventoryForPrompt(items);
      const result = await autoPlanMenu({
        inventory: inv, recipes, currentPlan: plan,
        days: DAYS.map((d) => d.id), meals: MEALS.map((m) => m.id),
      });
      // La IA devuelve una lista de asignaciones (antes era un objeto con los
      // huecos como claves, que no se puede describir con un esquema).
      const assignments = Array.isArray(result?.assignments) ? result.assignments : [];
      let count = 0;
      const usados = new Set();
      for (const a of assignments) {
        const slot = a?.slot;
        const rid = a?.recipeId;
        if (!slot || !rid || usados.has(slot)) continue;
        if (!plan[slot] && recipesById[rid]) {
          await cloudSetMenuSlot(hid, slot, rid);
          usados.add(slot);
          count++;
        }
      }
      toast(count > 0 ? t('menu.added', { n: count }) : t('menu.upToDate'));
    } catch (e) {
      toast(t('menu.genFail'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ height: '100%', background: pal.bg, display: 'flex', flexDirection: 'column' }}>
      <Header
        title={t('menu.title')}
        subtitle={t('menu.planned', { a: filled, b: totalSlots })}
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
          {busy ? t('menu.thinking') : tNodes('menu.tip', { icon: <strong>✨</strong> })}
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
            }}>{dayShort(d.id)}</div>
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
          }}>{dayLong(day.id)}</span>
          {isToday && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 7px',
              borderRadius: 8, background: pal.primary, color: '#fff',
            }}>{t('menu.today')}</span>
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
        <span>{mealLabel(meal.id)}</span>
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
            <div style={{ fontSize: 10, color: pal.inkFaint, marginTop: 2 }}>⏱ {t('common.minutesCompact', { n: recipe.time })}</div>
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
          <span>{t('menu.assign')}</span>
        </div>
      )}
    </button>
  );
};

const RecipePickerSheet = ({ slot, recipes, recipesById, currentId, onClose, onPick }) => {
  const { pal, fonts } = useLF();
  const [query, setQuery] = useState('');

  const dayName = dayLong(slot.day);
  const mealName = (MEALS.find((m) => m.id === slot.meal) ? mealLabel(slot.meal) : '');

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
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: pal.inkSoft, fontSize: 14, cursor: 'pointer', padding: 0 }}>{t('common.cancel')}</button>
          <div style={{ fontFamily: fonts.body, fontSize: 15, fontWeight: 600 }}>
            {dayName} · {mealName}
          </div>
          <div style={{ width: 60 }}/>
        </div>
        <div style={{ padding: '0 20px 12px' }}>
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder={t('menu.searchRecipe')}
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
                }}>{groupLabel(gKey)}</div>
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
  const dayName = dayLong(slot.day);
  const mealName = (MEALS.find((m) => m.id === slot.meal) ? mealLabel(slot.meal) : '');

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
              {dayName} · {mealName}
            </div>
            <div style={{ fontFamily: fonts.display, fontSize: 17, fontWeight: 700, color: pal.ink, marginTop: 2 }}>
              {recipe.name}
            </div>
          </div>
        </div>
        <Action icon="👁" label={t('menu.view')} onClick={() => onView(recipe.id)} />
        <Action icon="🔄" label={t('menu.change')} onClick={onReplace} />
        <Action icon="🗑" label={t('menu.remove')} onClick={onRemove} danger />
        <div style={{ height: 16 }}/>
      </div>
    </div>
  );
};
