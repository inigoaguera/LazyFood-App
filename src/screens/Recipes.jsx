import React, { useEffect, useState } from 'react';
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

// Re-exports para mantener compat con código que ya importa de aquí.
export { RECIPE_THUMBS, RecipeThumb };

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

  const yours = recipes.filter((r) => r.group === 'yours');

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

  useEffect(() => {
    if (!hid) return;
    let cancelled = false;
    (async () => {
      const cached = await getSetting(`aiRecipes:${hid}`);
      if (cached && !cancelled) setAiData(cached);
    })();
    return () => { cancelled = true; };
  }, [hid]);

  // Reemplaza una receta de IA por otra distinta. La IA recibe la lista de
  // todas las que ya están mostrándose para no repetir.
  const replaceSuggestion = async (section, indexInSection) => {
    if (!hid || !aiData) return;
    if (!proxyConfigured()) { toast('Configura la API', 'error'); return; }
    const slotKey = `${section}:${indexInSection}`;
    // Marcar el slot como "dándole otra vuelta..."
    setReplacingSlots((prev) => { const n = new Set(prev); n.add(slotKey); return n; });
    const inv = items.map((it) => {
      const qty = it.type === 'continuous' ? `${it.fill}% (${it.unit})` : `${it.qty} ${it.unit}`;
      const exp = it.expires != null && it.expires <= 5 ? ` ⚠ caduca pronto` : '';
      return `- ${it.name}: ${qty}${exp}`;
    }).join('\n');
    const avoid = [
      ...(aiData.effortless || []).map((r) => r.name),
      ...(aiData.chef || []).map((r) => r.name),
      ...(aiData.oneOff || []).map((r) => r.name),
    ].filter(Boolean);
    try {
      const fresh = await suggestReplacementRecipe({ inventory: inv, section, avoid });
      if (!fresh?.name) throw new Error('No vino nada');
      fresh.effort = Math.max(1, (fresh.tools || []).length);
      const next = { ...aiData, [section]: [...(aiData[section] || [])] };
      next[section][indexInSection] = fresh;
      setAiData(next);
      await setSetting(`aiRecipes:${hid}`, next);
    } catch (e) {
      toast(e?.message || 'No pude reemplazar', 'error');
    } finally {
      setReplacingSlots((prev) => { const n = new Set(prev); n.delete(slotKey); return n; });
    }
  };

  const inspire = async () => {
    if (!hid || !proxyConfigured()) return;
    if (!items.length) {
      toast('Añade items o importa datos para que pueda sugerir', 'error');
      return;
    }
    // Vaciamos las sugerencias actuales y mostramos la tarjeta global de "pensando"
    setAiData(null);
    setAiBusy(true);
    try {
      const inv = items.map((it) => {
        const qty = it.type === 'continuous' ? `${it.fill}% (${it.unit})` : `${it.qty} ${it.unit}`;
        const exp = it.expires != null && it.expires <= 5 ? ` ⚠ caduca en ${it.expires}d` : '';
        return `- ${it.name}: ${qty}${exp}`;
      }).join('\n');
      const result = await suggestRecipesForHub({ inventory: inv });
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
      toast('Sugerencias actualizadas ✨');
    } catch (e) {
      toast(e?.message || 'No he podido inspirarte', 'error');
    } finally { setAiBusy(false); }
  };

  // ─── Editor (crear/editar) y preview de IA ───────────────────────
  const [editing, setEditing] = useState(null); // { recipeId? } | null
  const [preview, setPreview] = useState(null); // recipe object IA | null
  const [filters, setFilters] = useState({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filteredYours = applyFilters(yours, filters, { stockByName: stockFor, detailsByName });
  const activeCount = countActive(filters);

  return (
    <Screen>
      <Header big title="Recetas ✨" subtitle="Tus recetas + sugerencias con lo que tienes"
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
            <div style={{ fontSize: 13, fontWeight: 700, color: pal.ink }}>Tienes {itemsCount} ingredientes</div>
            <div style={{ fontSize: 11, color: pal.inkSoft }}>Pídeme ideas conversando</div>
          </div>
          <button onClick={onOpenChat} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 999,
            background: pal.ink, border: 'none',
            color: pal.bg, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            boxShadow: LF_SHADOWS.sm,
          }}>
            <LFIcon name="sparkle" size={14} color={pal.accent} strokeWidth={2.2} />
            <span>¿Antojos?</span>
          </button>
        </div>
      </div>

      {/* Tus recetas */}
      <Section title="Tus recetas"
        subtitle={activeCount > 0 ? `${filteredYours.length} de ${yours.length} con filtros` : 'Las que creaste tú'}
        emoji="💚"
        inlineAction={
          <button onClick={() => setFiltersOpen(true)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '5px 12px', borderRadius: 14, cursor: 'pointer',
            background: activeCount > 0 ? pal.ink : pal.surface,
            color: activeCount > 0 ? pal.bg : pal.ink,
            border: `0.5px solid ${activeCount > 0 ? pal.ink : pal.lineStrong}`,
            fontSize: 11, fontWeight: 700,
            boxShadow: activeCount > 0 ? 'none' : LF_SHADOWS.sm,
          }}>
            <span>🔽</span><span>{activeCount > 0 ? `Filtrar (${activeCount})` : 'Filtrar'}</span>
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
            Ninguna receta tuya cumple los filtros.
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
          <Section title="Cero esfuerzo" subtitle="Listas con lo que tienes" emoji="😴" tag="✨ IA">
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

          <Section title="Modo chef" subtitle="Para cuando tengas tiempo" emoji="👨‍🍳" tag="✨ IA">
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

          <Section title="Te falta 1 ingrediente" subtitle="Casi listas" emoji="🎯" tag="✨ IA">
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
    ? new Date(aiData.generatedAt).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
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
              {aiBusy ? 'Pensando recetas…' : aiData ? 'Regenerar sugerencias' : 'Inspírame'}
            </div>
            <div style={{ fontSize: 11, opacity: 0.75 }}>
              {!hasItems ? 'Añade items primero'
                : aiData ? `Última: ${generatedDate}`
                : '9 ideas con lo que tienes'}
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
    La IA no devolvió sugerencias para esta sección esta vez
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
        <span style={{ fontSize: 12, fontWeight: 600 }}>Dándole otra vuelta…</span>
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
        Dándole otra vuelta…
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
          A ver qué tienes por casa…
        </div>
        <div style={{ fontSize: 12, color: pal.inkSoft, textAlign: 'center', maxWidth: 260, lineHeight: 1.4 }}>
          Estoy pensando 15 ideas con tu inventario. Tarda unos segundos.
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
    ? (stock.state === 'ready' ? 'Tienes todos los ingredientes' :
       stock.state === 'partial' ? `Te falta poco: ${[...stock.missing, ...stock.partial].map((i) => i.name).slice(0, 3).join(', ')}` :
       `Te faltan: ${stock.missing.map((i) => i.name).slice(0, 3).join(', ')}`)
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
        }} title={`Usa: ${expiringItems.join(', ')}`}>
          <span>⏳</span><span>Úsalo ya</span>
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
          <span>⏱ {recipe.time}m</span>
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
      <span style={{ fontSize: 11, fontWeight: 600 }}>Nueva receta</span>
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
          title="No me convence, dame otra"
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
          {recipe.time != null && <span>⏱ {recipe.time}m</span>}
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
          title="Dame otra"
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
            {recipe.time != null && <span>⏱ {recipe.time}m</span>}
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 8px', background: pal.accentSoft, borderRadius: 8,
          alignSelf: 'flex-start', marginTop: 6,
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: pal.ink }}>FALTA</span>
          <span style={{ fontSize: 11, color: pal.ink }}>{recipe.missingItem || 'algo'}</span>
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
          toast(`${recipe.missingItem} añadido a la lista`);
        } catch (e) { toast(e?.message || 'Error', 'error'); }
      }} style={{
        width: 56, flexShrink: 0, background: pal.primary,
        border: 'none', color: '#fff', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2,
      }}>
        <LFIcon name="plus" size={22} color="#fff" strokeWidth={2.4} />
        <span style={{ fontSize: 9, fontWeight: 700 }}>Lista</span>
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
        desc: recipe.why || `${recipe.name} con lo que tienes en casa.`,
        ingredients: (recipe.uses || []).map((name) => ({ name, qty: '', unit: '', itemId: null })),
        steps: recipe.steps || [],
        tools: recipe.tools || [],
      });
      await syncHousehold(hid);
      toast('Guardada en "Tus recetas"');
      onSavedAsOwn?.(created?.id);
    } catch (e) { toast(e?.message || 'Error', 'error'); }
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
            }}>✨ Sugerencia IA</div>
            <h1 style={{ fontFamily: fonts.display, fontSize: 24, fontWeight: 700, color: pal.ink, margin: 0, letterSpacing: '-0.02em' }}>
              {recipe.name}
            </h1>
            <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 13, color: pal.inkSoft }}>
              {recipe.time != null && <span>⏱ {recipe.time} min</span>}
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
                <strong>Te falta:</strong> {recipe.missingItem}
              </div>
            )}

            {recipe.uses?.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: pal.inkSoft, letterSpacing: '0.04em', textTransform: 'uppercase', marginTop: 18, marginBottom: 8 }}>
                  Ingredientes propuestos
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
                  Pasos
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
                  A fregar luego
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {recipe.tools.map((t, i) => (
                    <span key={i} style={{
                      padding: '5px 10px', borderRadius: 10,
                      background: pal.surface, border: `0.5px solid ${pal.line}`,
                      fontSize: 12, color: pal.ink,
                    }}>{t}</span>
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
          }}>Cerrar</button>
          <button onClick={saveAsRecipe} disabled={saving} style={{
            flex: 2, padding: 14, background: pal.primary, color: '#fff',
            border: 'none', borderRadius: 14,
            fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer',
          }}>
            {saving ? 'Guardando…' : '💾 Guardar como mi receta'}
          </button>
        </div>
      </div>
    </div>
  );
};
