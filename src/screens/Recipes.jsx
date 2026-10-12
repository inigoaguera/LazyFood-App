import React, { useEffect, useState } from 'react';
import { t, fmtDateTime, errMsg } from '../i18n/index.js';
import { groupLabel } from '../i18n/labels.js';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getSetting, setSetting, RECIPE_USES_EXPIRING_BY_NAME } from '../db.js';
import { useLF } from '../components/ctx.js';
import { Screen, Header, IconBtn, toast } from '../components/base.jsx';
import { LF_SHADOWS } from '../tokens/palettes.js';
import LFIcon from '../icons/LFIcon.jsx';
import { suggestRecipesForHub, suggestReplacementRecipe, proxyConfigured } from '../api.js';
import { RECIPE_THUMBS, RecipeThumb } from '../data/recipeThumbs.jsx';
import RecipeEditor from './RecipeEditor.jsx';
import { recipeStockStatus, stockBadge } from '../util/stock.js';
import RecipeFilters, { applyFilters, countActive } from './RecipeFilters.jsx';
import { inventoryForPrompt, pantrySignature } from '../util/aiInventory.js';
import { useBackClose } from '../util/nav.js';

// Re-exports para mantener compat con código que ya importa de aquí.
export { RECIPE_THUMBS, RecipeThumb };

// Cuántas recetas pide el hub a la IA en total (5 + 5 + 5). Ver suggestRecipesForHub.
const HUB_IDEAS = 15;

export default function RecipeHub({ onBack, onOpenRecipe, onOpenChat }) {
  const { pal, currentHouseholdMeta } = useLF();
  const hid = currentHouseholdMeta?.id;
  const recipes = useLiveQuery(
    () => hid ? db.recipes.where({ householdId: hid }).toArray() : Promise.resolve([]),
    [hid], []
  );
  const items = useLiveQuery(
    () => hid ? db.items.where({ householdId: hid }).toArray() : Promise.resolve([]),
    [hid], []
  );
  const recipeDetails = useLiveQuery(
    () => hid ? db.recipeDetails.where({ householdId: hid }).toArray() : Promise.resolve([]),
    [hid], []
  );
  const itemsCount = items.length;

  // Todas las recetas guardadas, sea cual sea su grupo. El editor deja elegir
  // entre yours/effortless/chef/oneOff, pero las otras tres secciones del hub
  // son sugerencias de IA en vivo, no recetas guardadas: filtrar por
  // group === 'yours' hacía desaparecer de la interfaz las que guardabas con
  // otro grupo (seguían en la base y sólo salían en el selector del menú).
  const yours = recipes;

  // Mapa nombre→ingredientes para calcular el indicador de stock por card
  const detailsByName = React.useMemo(() => {
    const m = new Map();
    for (const d of recipeDetails) m.set(d.matchName || d.name, d);
    return m;
  }, [recipeDetails]);
  const stockFor = React.useCallback((recipe) => {
    const det = detailsByName.get(recipe.name);
    if (!det || !det.ingredients?.length) return null; // sin info → sin badge
    return recipeStockStatus(det.ingredients, items);
  }, [detailsByName, items]);

  // ─── Cache de sugerencias IA ──────────────────────────────────────
  const [aiData, setAiData] = useState(null); // { effortless, chef, oneOff }
  const [aiBusy, setAiBusy] = useState(false); // true durante regenerar TODO
  const [replacingSlots, setReplacingSlots] = useState(() => new Set()); // "effortless:2" en marcha

  // Recetas descartadas con la ×. Se guardan junto a la firma de la despensa:
  // mientras el conjunto de productos no cambie no vuelven a proponerse, y en
  // cuanto entra compra nueva se empieza de cero (con otra despensa ese mismo
  // plato puede apetecer).
  const [rechazadas, setRechazadas] = useState([]);

  useEffect(() => {
    if (!hid) return;
    let cancelled = false;
    (async () => {
      const cached = await getSetting(`aiRecipes:${hid}`);
      if (cached && !cancelled) setAiData(cached);
      const desc = await getSetting(`descartadas:${hid}`);
      if (!cancelled && desc?.firma && desc.firma === pantrySignature(items)) {
        setRechazadas(desc.recetas || []);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hid]);

  // Lo que no queremos que vuelva: lo que está en pantalla ahora + lo descartado.
  const construirAvoid = React.useCallback((data) => {
    const enPantalla = [
      ...(data?.effortless || []), ...(data?.chef || []), ...(data?.oneOff || []),
    ].filter((r) => r?.name).map((r) => ({ name: r.name, uses: r.uses }));
    const vistas = new Set(enPantalla.map((r) => r.name.toLowerCase()));
    return [...enPantalla, ...rechazadas.filter((r) => !vistas.has((r.name || '').toLowerCase()))];
  }, [rechazadas]);

  const recordarDescarte = async (receta) => {
    if (!receta?.name) return;
    const siguiente = [...rechazadas, { name: receta.name, uses: receta.uses }].slice(-40);
    setRechazadas(siguiente);
    await setSetting(`descartadas:${hid}`, { firma: pantrySignature(items), recetas: siguiente });
  };

  // Reemplaza una receta de IA por otra distinta. La IA recibe la lista de
  // todas las que ya están mostrándose para no repetir.
  const replaceSuggestion = async (section, indexInSection) => {
    if (!hid || !aiData) return;
    if (!proxyConfigured()) { toast(t('recipes.hub.configureApi'), 'error'); return; }
    const slotKey = `${section}:${indexInSection}`;
    // Marcar el slot como "dándole otra vuelta..."
    setReplacingSlots((prev) => { const n = new Set(prev); n.add(slotKey); return n; });
    const inv = inventoryForPrompt(items);
    const descartada = (aiData[section] || [])[indexInSection];
    const avoid = construirAvoid(aiData);
    try {
      const fresh = await suggestReplacementRecipe({ inventory: inv, section, avoid });
      if (!fresh?.name) throw new Error(t('recipes.hub.nothingCame'));
      fresh.effort = Math.max(1, (fresh.tools || []).length);
      const next = { ...aiData, [section]: [...(aiData[section] || [])] };
      next[section][indexInSection] = fresh;
      setAiData(next);
      await setSetting(`aiRecipes:${hid}`, next);
      // La × es la señal más clara de "esto no me gusta" y hasta ahora se tiraba:
      // la receta salía de la lista y podía volver en el siguiente reemplazo.
      await recordarDescarte(descartada);
    } catch (e) {
      toast(errMsg(e, 'recipes.hub.replaceFail'), 'error');
    } finally {
      setReplacingSlots((prev) => { const n = new Set(prev); n.delete(slotKey); return n; });
    }
  };

  const inspire = async () => {
    if (!hid || !proxyConfigured()) return;
    if (!items.length) {
      toast(t('recipes.inspire.needItemsToast'), 'error');
      return;
    }
    // Se captura ANTES de vaciar: es lo que hay que decirle que no repita.
    const avoid = construirAvoid(aiData);
    // Vaciamos las sugerencias actuales y mostramos la tarjeta global de "pensando"
    setAiData(null);
    setAiBusy(true);
    try {
      const inv = inventoryForPrompt(items);
      // Sin esta lista, mismo inventario y mismo prompt devolvían casi las
      // mismas quince recetas cada vez que pulsabas Inspírame.
      const result = await suggestRecipesForHub({ inventory: inv, avoid });
      // Derivar effort = tools.length (mín 1) para que el icono 🍳 cuadre con la lista de instrumentos
      const enrichEffort = (arr) => (arr || []).map((r) => ({
        ...r,
        effort: Math.max(1, (r.tools || []).length),
      }));
      const fresh = {
        effortless: enrichEffort(result.effortless),
        chef: enrichEffort(result.chef),
        oneOff: enrichEffort(result.oneOff),
        generatedAt: Date.now(),
      };
      setAiData(fresh);
      await setSetting(`aiRecipes:${hid}`, fresh);
      toast(t('recipes.inspire.updated'));
    } catch (e) {
      toast(errMsg(e, 'recipes.inspire.fail'), 'error');
    } finally { setAiBusy(false); }
  };

  // ─── Editor (crear/editar) y preview de IA ───────────────────────
  const [editing, setEditing] = useState(null); // { recipeId? } | null
  const [preview, setPreview] = useState(null); // recipe object IA | null
  const [filters, setFilters] = useState({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  useBackClose(!!editing, () => setEditing(null));
  useBackClose(!!preview, () => setPreview(null));
  useBackClose(filtersOpen, () => setFiltersOpen(false));
  const filteredYours = applyFilters(yours, filters, { stockByName: stockFor, detailsByName });
  const activeCount = countActive(filters);

  return (
    <Screen>
      <Header big title={t('recipes.hub.title')} subtitle={t('recipes.hub.subtitle')}
        left={<IconBtn icon="chevronLeft" onClick={onBack} />}
        right={<IconBtn icon="search" tone="soft" />} />

      {/* Mini-card antojos chat */}
      <div style={{ padding: '0 20px 14px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: 14, background: pal.surface, borderRadius: 14,
          border: `0.5px solid ${pal.line}`, boxShadow: LF_SHADOWS.sm,
        }}>
          <div style={{ fontSize: 22 }}>🧠</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: pal.ink }}>{t('recipes.hub.pantry', { n: itemsCount })}</div>
            <div style={{ fontSize: 11, color: pal.inkSoft }}>{t('recipes.hub.chatHint')}</div>
          </div>
          <button onClick={onOpenChat} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 999,
            background: pal.ink, border: 'none',
            color: pal.bg, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            boxShadow: LF_SHADOWS.sm,
          }}>
            <LFIcon name="sparkle" size={14} color={pal.accent} strokeWidth={2.2} />
            <span>{t('recipes.hub.cravings')}</span>
          </button>
        </div>
      </div>

      {/* Tus recetas */}
      <Section title={groupLabel('yours')}
        subtitle={activeCount > 0 ? t('recipes.hub.filtered', { a: filteredYours.length, b: yours.length }) : t('recipes.hub.yoursSubtitle')}
        emoji="💚"
        inlineAction={
          <button onClick={() => setFiltersOpen(true)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '5px 12px', borderRadius: 14, cursor: 'pointer',
            background: activeCount > 0 ? pal.ink : pal.surface, // i18n-ignore
            color: activeCount > 0 ? pal.bg : pal.ink, // i18n-ignore
            border: `0.5px solid ${activeCount > 0 ? pal.ink : pal.lineStrong}`,
            fontSize: 11, fontWeight: 700,
            boxShadow: activeCount > 0 ? 'none' : LF_SHADOWS.sm,
          }}>
            <span>🔽</span><span>{activeCount > 0 ? t('recipes.hub.filterN', { n: activeCount }) : t('recipes.hub.filter')}</span>
          </button>
        }>
        <HScroll>
          {filteredYours.map((r) => (
            <RecipeCard key={r.id} recipe={r} stock={stockFor(r)} onClick={() => onOpenRecipe(r.id)} size="sm" />
          ))}
          <AddRecipeCard onClick={() => setEditing({})} />
        </HScroll>
        {activeCount > 0 && filteredYours.length === 0 && (
          <div style={{ padding: '0 20px', fontSize: 12, color: pal.inkFaint }}>
            {t('recipes.hub.noMatch')}
          </div>
        )}
      </Section>

      {/* Inspírame ──────────────────────────────────── */}
      <InspireBanner aiData={aiData} aiBusy={aiBusy} onInspire={inspire} hasItems={items.length > 0} />

      {/* Estado de regenerar TODO: tarjeta única reemplazando todas las secciones */}
      {aiBusy && (
        <RegenerateLoadingCard />
      )}

      {!aiBusy && aiData && (
        <>
          <Section title={groupLabel('effortless')} subtitle={t('recipes.hub.effortlessSubtitle')} emoji="😴" tag={t('recipes.hub.aiTag')}>
            {(aiData.effortless?.length || 0) > 0 ? (
              <HScroll>{aiData.effortless.map((r, idx) => (
                replacingSlots.has(`effortless:${idx}`)
                  ? <SlotPlaceholder key={`eff-${idx}`} size="sm" />
                  : <AICard key={`eff-${idx}`} recipe={r} size="sm" hid={hid}
                      onPreview={() => setPreview(r)}
                      onSavedAsOwn={(id) => id && onOpenRecipe(id)}
                      onDismiss={() => replaceSuggestion('effortless', idx)} />
              ))}</HScroll>
            ) : <EmptyAi pal={pal} />}
          </Section>

          <Section title={groupLabel('chef')} subtitle={t('recipes.hub.chefSubtitle')} emoji="👨‍🍳" tag={t('recipes.hub.aiTag')}>
            {(aiData.chef?.length || 0) > 0 ? (
              <HScroll>{aiData.chef.map((r, idx) => (
                replacingSlots.has(`chef:${idx}`)
                  ? <SlotPlaceholder key={`chef-${idx}`} size="lg" />
                  : <AICard key={`chef-${idx}`} recipe={r} size="lg" hid={hid}
                      onPreview={() => setPreview(r)}
                      onSavedAsOwn={(id) => id && onOpenRecipe(id)}
                      onDismiss={() => replaceSuggestion('chef', idx)} />
              ))}</HScroll>
            ) : <EmptyAi pal={pal} />}
          </Section>

          <Section title={groupLabel('oneOff')} subtitle={t('recipes.hub.oneOffSubtitle')} emoji="🎯" tag={t('recipes.hub.aiTag')}>
            {(aiData.oneOff?.length || 0) > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {aiData.oneOff.map((r, idx) => (
                  replacingSlots.has(`oneOff:${idx}`)
                    ? <SlotPlaceholder key={`one-${idx}`} variant="row" />
                    : <AIMissingCard key={`one-${idx}`} recipe={r} hid={hid}
                        onPreview={() => setPreview(r)}
                        onDismiss={() => replaceSuggestion('oneOff', idx)} />
                ))}
              </div>
            ) : <EmptyAi pal={pal} />}
          </Section>
        </>
      )}

      {editing && (
        <RecipeEditor
          recipeId={editing.recipeId}
          hid={hid}
          onClose={() => setEditing(null)}
          onSaved={(id) => { setEditing(null); if (id) onOpenRecipe?.(id); }}
        />
      )}

      {preview && (
        <AIPreviewModal recipe={preview} hid={hid}
          onClose={() => setPreview(null)}
          onSavedAsOwn={(id) => { setPreview(null); if (id) onOpenRecipe?.(id); }} />
      )}

      {filtersOpen && (
        <RecipeFilters filters={filters}
          inventory={items}
          onChange={setFilters}
          onClose={() => setFiltersOpen(false)} />
      )}
    </Screen>
  );
}

const InspireBanner = ({ aiData, aiBusy, onInspire, hasItems }) => {
  const { pal, fonts } = useLF();
  const generatedDate = aiData?.generatedAt
    ? fmtDateTime(aiData.generatedAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;
  return (
    <div style={{ padding: '0 20px 16px' }}>
      <button onClick={onInspire} disabled={aiBusy || !hasItems} style={{
        width: '100%', padding: '14px 18px', borderRadius: 16, cursor: (aiBusy || !hasItems) ? 'default' : 'pointer',
        background: pal.ink, color: pal.bg, border: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        boxShadow: LF_SHADOWS.md,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 22 }}>{aiBusy ? '⏳' : '✨'}</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontFamily: fonts.display, fontSize: 16, fontWeight: 700 }}>
              {aiBusy ? t('recipes.inspire.thinking') : aiData ? t('recipes.inspire.regenerate') : t('recipes.inspire.cta')}
            </div>
            <div style={{ fontSize: 11, opacity: 0.75 }}>
              {!hasItems ? t('recipes.inspire.needItems')
                : aiData ? t('recipes.inspire.last', { date: generatedDate })
                : t('recipes.inspire.ideas', { n: HUB_IDEAS })}
            </div>
          </div>
        </div>
        <span style={{ fontSize: 18 }}>›</span>
      </button>
    </div>
  );
};

const Section = ({ title, subtitle, action, inlineAction, emoji, tag, children }) => {
  const { pal, fonts } = useLF();
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ padding: '0 20px 10px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {emoji && <span style={{ fontSize: 18 }}>{emoji}</span>}
            <h2 style={{ fontFamily: fonts.display, fontSize: 20, fontWeight: 700, color: pal.ink, margin: 0, letterSpacing: '-0.015em' }}>{title}</h2>
            {tag && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8,
                background: pal.primarySoft, color: pal.primary,
              }}>{tag}</span>
            )}
            {inlineAction}
          </div>
          {subtitle && <div style={{ fontSize: 11, color: pal.inkSoft, marginTop: 2 }}>{subtitle}</div>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
};

const EmptyAi = ({ pal }) => (
  <div style={{
    margin: '0 20px', padding: 14, fontSize: 12, color: pal.inkFaint, textAlign: 'center',
    background: pal.surface, borderRadius: 12, border: `0.5px dashed ${pal.lineStrong}`,
  }}>
    {t('recipes.hub.emptyAi')}
  </div>
);

// Hueco gris cuando la IA está pensando una sustitución para ese slot
const SlotPlaceholder = ({ size = 'md', variant }) => {
  const { pal } = useLF();
  if (variant === 'row') {
    // Para "Te falta 1 ingrediente" — fila completa
    return (
      <div style={{
        margin: '0 20px', height: 92, borderRadius: 16,
        background: pal.line, border: `0.5px solid ${pal.lineStrong}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 8, color: pal.inkSoft,
        animation: 'lf-pulse 1.4s ease-in-out infinite',
      }}>
        <span style={{ fontSize: 18 }}>✨</span>
        <span style={{ fontSize: 12, fontWeight: 600 }}>{t('recipes.hub.rethinking')}</span>
      </div>
    );
  }
  const W = size === 'sm' ? 160 : size === 'lg' ? 220 : 200;
  const H = size === 'sm' ? 100 : size === 'lg' ? 140 : 110;
  return (
    <div style={{
      width: W, flexShrink: 0,
      background: pal.line, borderRadius: 16,
      border: `0.5px solid ${pal.lineStrong}`,
      animation: 'lf-pulse 1.4s ease-in-out infinite',
    }}>
      <div style={{
        height: H, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22,
      }}>✨</div>
      <div style={{
        padding: '10px 12px', fontSize: 11, fontWeight: 600,
        color: pal.inkSoft, textAlign: 'center', minHeight: 60,
      }}>
        {t('recipes.hub.rethinking')}
      </div>
      <style>{`@keyframes lf-pulse {
        0%, 100% { opacity: 0.55; }
        50% { opacity: 0.85; }
      }`}</style>
    </div>
  );
};

// Tarjeta única que reemplaza las 3 secciones cuando regenera todo
const RegenerateLoadingCard = () => {
  const { pal, fonts } = useLF();
  return (
    <div style={{ padding: '0 20px 20px' }}>
      <div style={{
        padding: 24, borderRadius: 18,
        background: pal.surface, border: `0.5px solid ${pal.line}`,
        boxShadow: LF_SHADOWS.sm,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          fontSize: 36,
          animation: 'lf-bounce 1.4s ease-in-out infinite',
        }}>✨</div>
        <div style={{ fontFamily: fonts.display, fontSize: 18, fontWeight: 700, color: pal.ink, textAlign: 'center' }}>
          {t('recipes.inspire.loadingTitle')}
        </div>
        <div style={{ fontSize: 12, color: pal.inkSoft, textAlign: 'center', maxWidth: 260, lineHeight: 1.4 }}>
          {t('recipes.inspire.loadingBody', { n: HUB_IDEAS })}
        </div>
        <style>{`@keyframes lf-bounce {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-6px) scale(1.05); }
        }`}</style>
      </div>
    </div>
  );
};

const HScroll = ({ children }) => (
  <div style={{
    display: 'flex', gap: 10, padding: '0 20px 4px',
    overflowX: 'auto', WebkitOverflowScrolling: 'touch',
  }}>{children}</div>
);

const RecipeCard = ({ recipe, stock, onClick, size = 'md' }) => {
  const { pal } = useLF();
  const W = size === 'sm' ? 160 : size === 'lg' ? 220 : '100%';
  const H = size === 'sm' ? 100 : size === 'lg' ? 140 : 110;
  const expiringItems = RECIPE_USES_EXPIRING_BY_NAME[recipe.name] || [];
  const usesExpiring = expiringItems.length > 0;
  const badge = stock ? stockBadge(stock.state, pal) : null;
  const tooltip = stock
    ? (stock.state === 'ready' ? t('recipes.card.haveAll') :
       stock.state === 'partial' ? t('recipes.card.almost', { names: [...stock.missing, ...stock.partial].map((i) => i.name).slice(0, 3).join(', ') }) :
       t('recipes.card.missing', { names: stock.missing.map((i) => i.name).slice(0, 3).join(', ') }))
    : '';
  return (
    <button onClick={onClick} style={{
      width: W, flexShrink: 0, textAlign: 'left',
      background: pal.surface, borderRadius: 16,
      border: `0.5px solid ${pal.line}`, boxShadow: LF_SHADOWS.sm,
      overflow: 'hidden', padding: 0, cursor: 'pointer', position: 'relative',
    }}>
      <RecipeThumb img={recipe.img} height={H} />
      {usesExpiring && (
        <div style={{
          position: 'absolute', top: 8, left: 8,
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '4px 8px', borderRadius: 10,
          background: pal.danger, color: '#fff',
          fontSize: 10, fontWeight: 700, boxShadow: LF_SHADOWS.sm,
        }} title={t('recipes.card.uses', { items: expiringItems.join(', ') })}>
          <span>⏳</span><span>{t('recipes.card.useNow')}</span>
        </div>
      )}
      {badge && (
        <div title={tooltip} style={{
          position: 'absolute', top: 8, right: 8,
          width: 24, height: 24, borderRadius: 12,
          background: badge.bg, color: badge.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 800, boxShadow: LF_SHADOWS.sm,
        }}>{badge.icon}</div>
      )}
      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: pal.ink, lineHeight: 1.2, minHeight: 32 }}>
          {recipe.name}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, fontSize: 11, color: pal.inkSoft, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>🍳 {recipe.effort}</span>
          <span>⏱ {t('common.minutesCompact', { n: recipe.time })}</span>
        </div>
      </div>
    </button>
  );
};

const AddRecipeCard = ({ onClick }) => {
  const { pal } = useLF();
  return (
    <button onClick={onClick} style={{
      width: 120, flexShrink: 0, background: 'transparent',
      borderRadius: 16, border: `2px dashed ${pal.lineStrong}`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 6, color: pal.inkSoft, cursor: 'pointer', padding: 20,
    }}>
      <LFIcon name="plus" size={22} />
      <span style={{ fontSize: 11, fontWeight: 600 }}>{t('recipes.card.newRecipe')}</span>
    </button>
  );
};

// Card de sugerencia IA. Tappable → abre preview. Sin tag IA (ya está en cabecera).
const AICard = ({ recipe, size = 'md', hid, onPreview, onSavedAsOwn, onDismiss }) => {
  const { pal } = useLF();
  const W = size === 'sm' ? 160 : size === 'lg' ? 220 : '100%';
  const H = size === 'sm' ? 100 : size === 'lg' ? 140 : 110;
  return (
    <div style={{
      width: W, flexShrink: 0, position: 'relative',
    }}>
      {onDismiss && (
        <button onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          title={t('recipes.card.dismiss')}
          style={{
            position: 'absolute', top: 6, right: 6, zIndex: 2,
            width: 24, height: 24, borderRadius: 12,
            background: 'rgba(20,25,18,0.55)', color: '#fff',
            border: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: 700, lineHeight: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>
      )}
      <button onClick={onPreview} style={{
        width: '100%', textAlign: 'left', cursor: 'pointer',
        background: pal.surface, borderRadius: 16,
        border: `0.5px solid ${pal.line}`, boxShadow: LF_SHADOWS.sm,
        overflow: 'hidden', padding: 0,
      }}>
      <RecipeThumb img={recipe.img || 'pasta'} height={H} />
      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: pal.ink, lineHeight: 1.2, minHeight: 32 }}>
          {recipe.name}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 11, color: pal.inkSoft, alignItems: 'center' }}>
          {recipe.effort != null && <span>🍳 {recipe.effort}</span>}
          {recipe.time != null && <span>⏱ {t('common.minutesCompact', { n: recipe.time })}</span>}
        </div>
        {recipe.uses?.length > 0 && (
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 6 }}>
            {recipe.uses.slice(0, 3).map((u, i) => (
              <span key={i} style={{
                fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 6,
                background: pal.primarySoft, color: pal.primary,
              }}>{u}</span>
            ))}
          </div>
        )}
      </div>
      </button>
    </div>
  );
};

const AIMissingCard = ({ recipe, hid, onPreview, onDismiss }) => {
  const { pal } = useLF();
  return (
    <div style={{
      margin: '0 20px', background: pal.surface,
      borderRadius: 16, border: `0.5px solid ${pal.line}`,
      boxShadow: LF_SHADOWS.sm, overflow: 'hidden',
      display: 'flex', alignItems: 'stretch', cursor: 'pointer',
      position: 'relative',
    }} onClick={onPreview}>
      {onDismiss && (
        <button onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          title={t('recipes.card.dismissShort')}
          style={{
            position: 'absolute', top: 6, right: 6, zIndex: 2,
            width: 22, height: 22, borderRadius: 11,
            background: 'rgba(20,25,18,0.55)', color: '#fff',
            border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 700, lineHeight: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>
      )}
      <div style={{ width: 92, flexShrink: 0 }}>
        <RecipeThumb img={recipe.img || 'pasta'} height={92} />
      </div>
      <div style={{ flex: 1, padding: '10px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: pal.ink }}>{recipe.name}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 11, color: pal.inkSoft }}>
            {recipe.effort != null && <span>🍳 {recipe.effort}</span>}
            {recipe.time != null && <span>⏱ {t('common.minutesCompact', { n: recipe.time })}</span>}
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 8px', background: pal.accentSoft, borderRadius: 8,
          alignSelf: 'flex-start', marginTop: 6,
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: pal.ink }}>{t('recipes.card.missingTag')}</span>
          <span style={{ fontSize: 11, color: pal.ink }}>{recipe.missingItem || t('recipes.card.missingFallback')}</span>
        </div>
      </div>
      <button onClick={async (e) => {
        e.stopPropagation();
        try {
          const { create } = await import('../api/resources.js');
          const { syncHousehold } = await import('../api/sync.js');
          await create('shopping', hid, {
            name: recipe.missingItem, qty: '', cat: null, checked: 0, auto: 1, count: 1,
          });
          await syncHousehold(hid);
          toast(t('recipes.card.addedToList', { item: recipe.missingItem }));
        } catch (e) { toast(errMsg(e), 'error'); }
      }} style={{
        width: 56, flexShrink: 0, background: pal.primary,
        border: 'none', color: '#fff', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2,
      }}>
        <LFIcon name="plus" size={22} color="#fff" strokeWidth={2.4} />
        <span style={{ fontSize: 9, fontWeight: 700 }}>{t('recipes.card.listBtn')}</span>
      </button>
    </div>
  );
};

// Modal full-screen con la info que devolvió la IA + botón guardar.
const AIPreviewModal = ({ recipe, hid, onClose, onSavedAsOwn }) => {
  const { pal, fonts } = useLF();
  const [saving, setSaving] = useState(false);

  const saveAsRecipe = async () => {
    setSaving(true);
    try {
      const { create } = await import('../api/resources.js');
      const { syncHousehold } = await import('../api/sync.js');
      const created = await create('recipes', hid, {
        name: recipe.name,
        time: Number(recipe.time) || 15,
        effort: Number(recipe.effort) || 1,
        img: recipe.img || 'pasta',
        group: 'yours',
        author: 'ia',
      });
      await create('recipeDetails', hid, {
        matchName: recipe.name,
        name: recipe.name,
        time: Number(recipe.time) || 15,
        effort: Number(recipe.effort) || 1,
        servings: 2,
        img: recipe.img || 'pasta',
        desc: recipe.why || t('recipes.withWhatYouHave', { name: recipe.name }),
        ingredients: (recipe.uses || []).map((name) => ({ name, qty: '', unit: '', itemId: null })),
        steps: recipe.steps || [],
        tools: recipe.tools || [],
      });
      await syncHousehold(hid);
      toast(t('recipes.preview.saved'));
      onSavedAsOwn?.(created?.id);
    } catch (e) { toast(errMsg(e), 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 60,
      background: 'rgba(20,25,18,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-end',
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxHeight: '90%', background: pal.bg,
        borderTopLeftRadius: 28, borderTopRightRadius: 28,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        animation: 'slideUp .28s cubic-bezier(.3,.7,.4,1)',
      }}>
        <div style={{ padding: '10px 0 0', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: pal.lineStrong }}/>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <RecipeThumb img={recipe.img || 'pasta'} height={200} />
          <div style={{ padding: '16px 22px 24px' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 8px', background: pal.primarySoft, color: pal.primary,
              borderRadius: 8, fontSize: 10, fontWeight: 700, marginBottom: 8,
            }}>{t('recipes.preview.badge')}</div>
            <h1 style={{ fontFamily: fonts.display, fontSize: 24, fontWeight: 700, color: pal.ink, margin: 0, letterSpacing: '-0.02em' }}>
              {recipe.name}
            </h1>
            <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 13, color: pal.inkSoft }}>
              {recipe.time != null && <span>⏱ {t('common.minutesShort', { n: recipe.time })}</span>}
              {recipe.effort != null && <span>🍳 {recipe.effort}</span>}
            </div>
            {recipe.why && (
              <p style={{ fontSize: 13, color: pal.inkSoft, marginTop: 12, lineHeight: 1.5 }}>{recipe.why}</p>
            )}
            {recipe.missingItem && (
              <div style={{
                marginTop: 12, padding: 10, background: pal.accentSoft, borderRadius: 12,
                fontSize: 13, color: pal.ink,
              }}>
                <strong>{t('recipes.preview.youMiss')}</strong> {recipe.missingItem}
              </div>
            )}

            {recipe.uses?.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: pal.inkSoft, letterSpacing: '0.04em', textTransform: 'uppercase', marginTop: 18, marginBottom: 8 }}>
                  {t('recipes.preview.proposed')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {recipe.uses.map((u, i) => (
                    <div key={i} style={{
                      padding: '10px 14px', background: pal.surface, borderRadius: 10,
                      border: `0.5px solid ${pal.line}`, fontSize: 13, color: pal.ink,
                    }}>{u}</div>
                  ))}
                </div>
              </>
            )}

            {recipe.steps?.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: pal.inkSoft, letterSpacing: '0.04em', textTransform: 'uppercase', marginTop: 18, marginBottom: 8 }}>
                  {t('recipes.steps')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {recipe.steps.map((s, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{
                        flexShrink: 0, width: 24, height: 24, borderRadius: 12,
                        background: pal.primary, color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700,
                      }}>{i + 1}</span>
                      <div style={{ fontSize: 13, color: pal.ink, lineHeight: 1.5, paddingTop: 2 }}>{s}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {recipe.tools?.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: pal.inkSoft, letterSpacing: '0.04em', textTransform: 'uppercase', marginTop: 18, marginBottom: 8 }}>
                  {t('recipes.preview.toWash')}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {recipe.tools.map((tool, i) => (
                    <span key={i} style={{
                      padding: '5px 10px', borderRadius: 10,
                      background: pal.surface, border: `0.5px solid ${pal.line}`,
                      fontSize: 12, color: pal.ink,
                    }}>{tool}</span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{
          padding: '12px 18px 20px', background: pal.surface,
          borderTop: `0.5px solid ${pal.line}`, display: 'flex', gap: 10,
        }}>
          <button onClick={onClose} style={{
            flex: 1, padding: 14, background: pal.bg,
            border: `0.5px solid ${pal.line}`, borderRadius: 14,
            color: pal.inkSoft, fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>{t('common.close')}</button>
          <button onClick={saveAsRecipe} disabled={saving} style={{
            flex: 2, padding: 14, background: pal.primary, color: '#fff',
            border: 'none', borderRadius: 14,
            fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer',
          }}>
            {saving ? t('common.saving') : t('recipes.preview.save')}
          </button>
        </div>
      </div>
    </div>
  );
};
