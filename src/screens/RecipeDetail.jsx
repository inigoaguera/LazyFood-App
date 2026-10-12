import React, { useState, useEffect } from 'react';
import { unitLabel } from '../i18n/labels.js';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db.js';
import { useLF } from '../components/ctx.js';
import { Screen, IconBtn, Button, toast } from '../components/base.jsx';
import { RecipeThumb } from '../data/recipeThumbs.jsx';
import LFIcon from '../icons/LFIcon.jsx';
import { patch as resourcePatch, create as resourceCreate } from '../api/resources.js';
import { syncHousehold } from '../api/sync.js';
import RecipeEditor from './RecipeEditor.jsx';
import { scaleRecipeServings, proxyConfigured } from '../api.js';
import { recipeStockStatus, findInventoryMatch } from '../util/stock.js';
import { useBackClose } from '../util/nav.js';
import { t, errMsg } from '../i18n/index.js';

export default function RecipeDetail({ recipeId, onBack, onCooked }) {
  const { pal, fonts, currentHouseholdMeta } = useLF();
  const hid = currentHouseholdMeta?.id;
  const [editing, setEditing] = useState(false);
  useBackClose(editing, () => setEditing(false));
  const recipe = useLiveQuery(() => db.recipes.get(recipeId), [recipeId]);
  const detail = useLiveQuery(async () => {
    if (!recipe || !hid) return null;
    const all = await db.recipeDetails.where({ householdId: hid }).toArray();
    return all.find((d) => d.matchName === recipe.name) || null;
  }, [recipe?.name, hid]);
  const inventory = useLiveQuery(
    () => hid ? db.items.where({ householdId: hid }).toArray() : Promise.resolve([]),
    [hid], []
  );

  // Estado de raciones — se inicializa con el valor original de la receta
  const baseServings = detail?.servings || 2;
  const [servings, setServings] = useState(baseServings);
  const [scaledIngredients, setScaledIngredients] = useState(null); // null = usar originales
  const [scaling, setScaling] = useState(false);
  // Para qué nº de raciones se aplicó el último reescalado IA
  const [scaledFor, setScaledFor] = useState(null);

  // Reset cuando cambia la receta
  useEffect(() => {
    setServings(baseServings);
    setScaledIngredients(null);
    setScaledFor(null);
  }, [recipeId, baseServings]);

  if (!recipe) {
    return (
      <Screen>
        <div style={{ padding: 40, textAlign: 'center', color: pal.inkSoft }}>{t('common.loading')}</div>
      </Screen>
    );
  }

  const originalIngredients = detail?.ingredients || [
    { name: t('recipes.detail.defaultIngredient'), qty: t('recipes.detail.defaultQty') },
  ];
  const r = {
    name: recipe.name,
    img: recipe.img,
    time: recipe.time,
    effort: recipe.effort,
    desc: detail?.desc || t('recipes.descFallback', { name: recipe.name, time: recipe.time }),
    servings,
    ingredients: scaledIngredients || originalIngredients,
    steps: detail?.steps || [
      t('recipes.detail.defaultStep1'),
      t('recipes.detail.defaultStep2'),
      t('recipes.detail.defaultStep3'),
    ],
  };

  // Sólo actualiza el número de raciones — NO llama a la IA todavía.
  // El usuario tiene que pulsar "Reajustar cantidades" cuando esté listo.
  const changeServings = (next) => {
    if (next < 1) return;
    setServings(next);
    if (next === baseServings) {
      setScaledIngredients(null);
      setScaledFor(null);
    }
  };

  const rescaleNow = async () => {
    if (servings === baseServings) return;
    if (!proxyConfigured()) {
      // Fallback: lineal sin IA
      const ratio = servings / baseServings;
      setScaledIngredients(originalIngredients.map((ing) => {
        const numeric = Number(String(ing.qty).replace(',', '.'));
        if (Number.isFinite(numeric)) {
          return { ...ing, qty: String(+(numeric * ratio).toFixed(2)) };
        }
        return ing;
      }));
      setScaledFor(servings);
      return;
    }
    setScaling(true);
    try {
      const res = await scaleRecipeServings({
        recipeName: recipe.name,
        fromServings: baseServings,
        toServings: servings,
        ingredients: originalIngredients,
      });
      const updated = res?.ingredients || [];
      const out = originalIngredients.map((ing, idx) => {
        const change = updated.find((u) => u.index === idx);
        if (!change) return ing;
        return { ...ing, qty: change.qty != null ? String(change.qty) : ing.qty, unit: change.unit ?? ing.unit };
      });
      setScaledIngredients(out);
      setScaledFor(servings);
    } catch (e) {
      toast(errMsg(e, 'recipes.detail.rescaleFail'), 'error');
    } finally { setScaling(false); }
  };
  // El "OK" sólo aparece si hay diferencia entre lo pedido y lo aplicado
  const needsRescale = servings !== baseServings && scaledFor !== servings;

  const handleCooked = async () => {
    if (!hid) return;
    const items = await db.items.where({ householdId: hid }).toArray();
    let consumed = 0;
    const missing = []; // ingredientes que no encontramos o que están a 0
    const approx = []; // descontados "a ojo" porque las unidades no casaban

    // "uds"/"unidades"/"ud" son la misma cosa (y "pcs"/"pieces"/"units" en
    // inglés); latas y paquetes igual. El resto se compara tal cual.
    const normalizeUnit = (u) => {
      const s = String(u || '').trim().toLowerCase();
      if (!s) return '';
      if (['ud', 'uds', 'unidad', 'unidades', 'u', 'pc', 'pcs', 'piece', 'pieces', 'unit', 'units'].includes(s)) return 'uds';
      if (['can', 'cans', 'tin', 'tins'].includes(s)) return 'latas';
      if (['pack', 'packs'].includes(s)) return 'paquetes';
      return s;
    };

    // Parsea "0.25", "0,25", "1/4", "200" etc. → número o NaN
    const parseQty = (raw) => {
      if (raw == null || raw === '') return NaN;
      const s = String(raw).trim().replace(',', '.');
      // Soporta fracciones simples "1/4"
      if (s.includes('/')) {
        const [a, b] = s.split('/').map((n) => Number(n.trim()));
        if (Number.isFinite(a) && Number.isFinite(b) && b !== 0) return a / b;
        return NaN;
      }
      const n = Number(s);
      return Number.isFinite(n) ? n : NaN;
    };

    for (const ing of r.ingredients) {
      // Prioridad 1: vinculado por itemId. Prioridad 2: fuzzy por nombre.
      let match = ing.itemId ? items.find((it) => it.id === ing.itemId) : null;
      // Mismo emparejado por nombre que el badge de stock (util/stock.js):
      // un ingrediente sin nombre no casa con nada.
      if (!match) match = findInventoryMatch(ing.name, items);
      if (!match) {
        missing.push(ing);
        continue;
      }
      try {
        const ingQty = parseQty(ing.qty);
        // Las unidades tienen que ser comparables para poder restar la cantidad
        // de la receta. Sin esta comprobación, "200 g" de pasta restaba 200
        // PAQUETES del inventario y dejaba el item a cero de un plumazo.
        const ingUnit = normalizeUnit(ing.unit);
        const itemUnit = normalizeUnit(match.unit);
        const comparable = !ingUnit || ingUnit === itemUnit;

        if (match.type === 'discrete' && match.qty > 0) {
          const exact = comparable && Number.isFinite(ingQty) && ingQty > 0;
          const dec = exact ? ingQty : 1;
          if (!exact && Number.isFinite(ingQty) && ingQty > 1) approx.push(ing);
          const next = Math.max(0, +(match.qty - dec).toFixed(2));
          await resourcePatch('items', hid, match.id, { qty: next });
          consumed++;
        } else if (match.type === 'continuous' && match.fill > 0) {
          // Los continuos guardan un porcentaje de llenado, no una cantidad
          // absoluta: sin saber la capacidad del envase no se puede traducir
          // "200 ml" a un %. Se descuenta un 15% fijo y se avisa.
          if (Number.isFinite(ingQty) && ingQty > 0) approx.push(ing);
          await resourcePatch('items', hid, match.id, { fill: Math.max(0, match.fill - 15) });
          consumed++;
        } else {
          // El item existe pero está agotado
          missing.push(ing);
        }
      } catch (e) { /* sigue */ }
    }

    if (missing.length === 0) {
      const base = t('recipes.detail.cooked', { n: consumed });
      toast(approx.length
        ? t('recipes.detail.cookedApprox', { base, names: approx.map((a) => a.name).join(', ') })
        : base);
    } else {
      const names = missing.map((m) => m.name).join(', ');
      toast(t('recipes.detail.youMiss', { names }), 'info', {
        action: {
          label: t('recipes.detail.toShopping'),
          onClick: async () => {
            try {
              for (const m of missing) {
                // Texto libre que se guarda tal cual: con la etiqueta, no la clave.
                const qtyStr = [m.qty, m.unit && unitLabel(m.unit)].filter(Boolean).join(' ');
                await resourceCreate('shopping', hid, {
                  name: m.name, qty: qtyStr, cat: null,
                  checked: 0, auto: 1, count: 1,
                });
              }
              await syncHousehold(hid);
              toast(t('recipes.detail.sentToList', { n: missing.length }));
            } catch (e) { toast(errMsg(e), 'error'); }
          },
        },
      });
    }
    onCooked?.();
  };

  return (
    <Screen padBottom={120}>
      <div style={{ position: 'relative' }}>
        <RecipeThumb img={r.img} height={240} />
        <div style={{ position: 'absolute', top: 12, left: 16, right: 16, display: 'flex', justifyContent: 'space-between' }}>
          <IconBtn icon="chevronLeft" tone="soft" onClick={onBack} />
          <div style={{ display: 'flex', gap: 8 }}>
            <IconBtn icon="pencil" tone="soft" onClick={() => setEditing(true)} />
          </div>
        </div>
      </div>

      <div style={{ padding: '18px 20px 0' }}>
        <h1 style={{ fontFamily: fonts.display, fontSize: 28, fontWeight: 700, color: pal.ink, margin: 0, letterSpacing: '-0.02em' }}>
          {r.name}
        </h1>
        <p style={{ fontSize: 14, color: pal.inkSoft, marginTop: 6 }}>{r.desc}</p>

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <Stat icon="⏱" label={t('recipes.detail.time')} value={t('common.minutesShort', { n: r.time })} />
          <Stat icon="🍳" label={t('recipes.detail.toWash')} value={`${r.effort}`} />
          <ServingsStat servings={r.servings} baseServings={baseServings} scaling={scaling}
            onChange={changeServings} />
        </div>
      </div>

      {(() => {
        const stock = recipeStockStatus(originalIngredients, inventory);
        if (stock.state === 'ready') return null;
        const missingNames = [...stock.missing, ...stock.partial].map((i) => i.name);
        if (missingNames.length === 0) return null;
        const isPartial = stock.state === 'partial';
        return (
          <div style={{ padding: '14px 20px 0' }}>
            <div style={{
              padding: 14, borderRadius: 14,
              background: isPartial ? pal.accentSoft : pal.dangerSoft,
              color: isPartial ? pal.ink : pal.danger,
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <span style={{ fontSize: 20, lineHeight: 1 }}>{isPartial ? '⚠' : '✗'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                  {isPartial ? t('recipes.detail.almostThere') : t('recipes.detail.missingIngredients')}
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.4 }}>
                  {missingNames.join(', ')}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {needsRescale && (
        <div style={{ padding: '14px 20px 0' }}>
          <button onClick={rescaleNow} disabled={scaling} style={{
            width: '100%', padding: 12, borderRadius: 14,
            background: pal.ink, color: pal.bg, border: 'none',
            fontSize: 13, fontWeight: 700, cursor: scaling ? 'default' : 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <span>✨</span>
            <span>{t('recipes.detail.rescale', { n: servings })}</span>
          </button>
        </div>
      )}

      <div style={{ padding: '22px 20px 8px' }}>
        <h3 style={{ fontFamily: fonts.display, fontSize: 18, fontWeight: 700, color: pal.ink, margin: '0 0 10px' }}>{t('recipes.ingredients')}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {r.ingredients.map((ing, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px', background: ing.have ? pal.surface : pal.accentSoft,
              borderRadius: 12, border: `0.5px solid ${ing.have ? pal.line : pal.accent}`,
            }}>
              <span style={{
                width: 22, height: 22, borderRadius: 11,
                background: ing.have ? pal.primary : 'transparent',
                border: ing.have ? 'none' : `1.5px solid ${pal.accent}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {ing.have ? <LFIcon name="check" size={14} color="#fff" strokeWidth={3} /> : <LFIcon name="plus" size={12} color={pal.accent} strokeWidth={2.5} />}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: pal.ink }}>{ing.name}</div>
                {ing.note && <div style={{ fontSize: 11, color: pal.inkSoft, marginTop: 2 }}>{ing.note}</div>}
              </div>
              <div style={{ fontSize: 13, color: pal.inkSoft }}>
                {ing.qty}{ing.unit ? ` ${unitLabel(ing.unit)}` : ''}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '20px 20px 20px' }}>
        <h3 style={{ fontFamily: fonts.display, fontSize: 18, fontWeight: 700, color: pal.ink, margin: '0 0 10px' }}>{t('recipes.steps')}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {r.steps.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{
                flexShrink: 0, width: 28, height: 28, borderRadius: 14,
                background: pal.primary, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: fonts.display, fontSize: 14, fontWeight: 700,
              }}>{i + 1}</span>
              <div style={{ fontSize: 14, color: pal.ink, lineHeight: 1.5, paddingTop: 4 }}>{s}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 20, left: 20, right: 20, zIndex: 5 }}>
        <Button tone="green" size="xl" fullWidth onClick={handleCooked} icon="fire">
          {t('recipes.detail.cook')}&nbsp;<span style={{ fontWeight: 500, opacity: 0.85, fontSize: 13 }}>{t('recipes.detail.cookHint')}</span>
        </Button>
      </div>

      {editing && (
        <RecipeEditor recipeId={recipeId} hid={hid}
          onClose={() => setEditing(false)}
          onSaved={(id) => { setEditing(false); if (id == null) onBack?.(); }} />
      )}

      {scaling && <ScalingOverlay />}
    </Screen>
  );
}

const ScalingOverlay = () => {
  const { pal, fonts } = useLF();
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 80,
      background: 'rgba(20,25,18,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: pal.bg, padding: '24px 28px', borderRadius: 18,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        boxShadow: '0 18px 40px rgba(0,0,0,0.25)',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 28, background: pal.primarySoft,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28,
          animation: 'pulse 1.4s infinite ease-in-out',
        }}>✨</div>
        <div style={{ fontFamily: fonts.display, fontSize: 16, fontWeight: 700, color: pal.ink }}>
          {t('recipes.detail.adjusting')}
        </div>
        <div style={{ fontSize: 12, color: pal.inkSoft, textAlign: 'center', maxWidth: 200 }}>
          {t('recipes.detail.adjustingHint')}
        </div>
        <style>{`@keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: 0.85; }
        }`}</style>
      </div>
    </div>
  );
};

const Stat = ({ icon, label, value }) => {
  const { pal, fonts } = useLF();
  return (
    <div style={{
      flex: 1, padding: '10px 8px', background: pal.surface,
      borderRadius: 12, border: `0.5px solid ${pal.line}`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    }}>
      <div style={{ fontSize: 18 }}>{icon}</div>
      <div style={{ fontSize: 10, color: pal.inkFaint, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontFamily: fonts.display, fontSize: 15, fontWeight: 700, color: pal.ink }}>{value}</div>
    </div>
  );
}

const ServingsStat = ({ servings, baseServings, scaling, onChange }) => {
  const { pal, fonts } = useLF();
  const scaled = servings !== baseServings;
  return (
    <div style={{
      flex: 1, padding: '10px 8px', background: pal.surface,
      borderRadius: 12, border: scaled ? `1px solid ${pal.primary}` : `0.5px solid ${pal.line}`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
      position: 'relative',
    }}>
      <div style={{ fontSize: 18 }}>👥</div>
      <div style={{ fontSize: 10, color: pal.inkFaint, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {scaling ? t('recipes.detail.rescaling') : t('recipes.detail.servings')}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
        <button onClick={() => onChange(servings - 1)} disabled={scaling || servings <= 1} style={{
          width: 22, height: 22, borderRadius: 11, padding: 0,
          background: pal.bg, border: `0.5px solid ${pal.line}`,
          fontSize: 14, fontWeight: 700, color: pal.ink,
          cursor: scaling || servings <= 1 ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>−</button>
        <div style={{ fontFamily: fonts.display, fontSize: 17, fontWeight: 700, color: pal.ink, minWidth: 18, textAlign: 'center' }}>
          {servings}
        </div>
        <button onClick={() => onChange(servings + 1)} disabled={scaling} style={{
          width: 22, height: 22, borderRadius: 11, padding: 0,
          background: pal.primary, border: 'none',
          fontSize: 14, fontWeight: 700, color: '#fff',
          cursor: scaling ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>+</button>
      </div>
      {scaled && !scaling && (
        <div style={{ fontSize: 9, color: pal.primary, marginTop: 2 }}>{t('recipes.detail.adjusted')}</div>
      )}
    </div>
  );
};
