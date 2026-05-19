import React, { useState, useMemo } from 'react';
import { useLF } from '../components/ctx.js';

// Estado tipo: { time: 30, tools: 2, available: true, ingredients: ['tomate', 'pollo'] }

export const FILTER_DEFS = {
  time: [
    { id: 15, label: '≤15 min' },
    { id: 30, label: '≤30 min' },
    { id: 60, label: '≤1h' },
    { id: 9999, label: '+1h' },
  ],
  tools: [
    { id: 2, label: '≤2 cacharros' },
    { id: 4, label: '3-4 cacharros' },
    { id: 99, label: '5+ cacharros' },
  ],
};

// Aplica los filtros a un array de recetas. Necesita stockByName y detailsByName
// para los filtros de stock e ingredientes (sólo para tus recetas guardadas).
export function applyFilters(recipes, filters, { stockByName, detailsByName } = {}) {
  return recipes.filter((r) => {
    if (filters.time != null) {
      if (filters.time === 9999) {
        if ((r.time || 0) <= 60) return false;
      } else {
        if ((r.time || 0) > filters.time) return false;
      }
    }
    if (filters.tools != null) {
      const t = r.effort || 0;
      if (filters.tools === 2 && t > 2) return false;
      if (filters.tools === 4 && (t < 3 || t > 4)) return false;
      if (filters.tools === 99 && t < 5) return false;
    }
    if (filters.available) {
      const stock = stockByName?.(r);
      if (!stock || stock.state !== 'ready') return false;
    }
    if (filters.ingredients?.length && detailsByName) {
      const det = detailsByName.get(r.name);
      const ingNames = (det?.ingredients || []).map((i) => (i.name || '').toLowerCase());
      const allMatch = filters.ingredients.every((wanted) => {
        const w = wanted.toLowerCase();
        return ingNames.some((n) => n.includes(w) || w.includes(n.split(' ')[0]));
      });
      if (!allMatch) return false;
    }
    return true;
  });
}

export function countActive(filters) {
  let n = 0;
  if (filters.time != null) n++;
  if (filters.tools != null) n++;
  if (filters.available) n++;
  if (filters.ingredients?.length) n++;
  return n;
}

export default function RecipeFilters({ filters, inventory = [], onChange, onClose }) {
  const { pal, fonts } = useLF();
  const setFilter = (k, v) => onChange({ ...filters, [k]: v });
  const clearAll = () => onChange({});

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 50,
      background: 'rgba(20,25,18,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-end',
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxHeight: '88%', background: pal.bg,
        borderTopLeftRadius: 28, borderTopRightRadius: 28,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        animation: 'slideUp .28s cubic-bezier(.3,.7,.4,1)',
      }}>
        <div style={{ padding: '10px 0 4px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: pal.lineStrong }}/>
        </div>
        <div style={{ padding: '4px 22px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={clearAll} style={{ background: 'transparent', border: 'none', color: pal.danger, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Limpiar</button>
          <div style={{ fontFamily: fonts.display, fontSize: 17, fontWeight: 700, color: pal.ink }}>Filtros</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: pal.primary, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Aplicar</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 22px 20px' }}>
          <Group label="🥕 Por ingrediente">
            <IngredientPicker inventory={inventory}
              selected={filters.ingredients || []}
              onChange={(arr) => setFilter('ingredients', arr.length ? arr : null)} />
          </Group>

          <Group label="⏱ Tiempo">
            <ChipsRow>
              {FILTER_DEFS.time.map((opt) => (
                <Chip key={opt.id} pal={pal} active={filters.time === opt.id}
                  onClick={() => setFilter('time', filters.time === opt.id ? null : opt.id)}>
                  {opt.label}
                </Chip>
              ))}
            </ChipsRow>
          </Group>

          <Group label="🍳 A fregar">
            <ChipsRow>
              {FILTER_DEFS.tools.map((opt) => (
                <Chip key={opt.id} pal={pal} active={filters.tools === opt.id}
                  onClick={() => setFilter('tools', filters.tools === opt.id ? null : opt.id)}>
                  {opt.label}
                </Chip>
              ))}
            </ChipsRow>
          </Group>

          <Group label="✅ Stock">
            <Chip pal={pal} active={!!filters.available}
              onClick={() => setFilter('available', !filters.available)}>
              Sólo las que puedo hacer ahora
            </Chip>
          </Group>
        </div>
      </div>
    </div>
  );
}

// Picker de ingredientes con autocomplete contra inventario.
// Multi-select: lista chips con × abajo, input arriba con sugerencias filtradas.
const IngredientPicker = ({ inventory, selected, onChange }) => {
  const { pal } = useLF();
  const [query, setQuery] = useState('');
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return inventory
      .filter((it) => it.name?.toLowerCase().startsWith(q))
      .filter((it) => !selected.some((s) => s.toLowerCase() === it.name.toLowerCase()))
      .slice(0, 8);
  }, [query, inventory, selected]);

  const add = (name) => {
    if (selected.some((s) => s.toLowerCase() === name.toLowerCase())) return;
    onChange([...selected, name]);
    setQuery('');
  };
  const remove = (name) => onChange(selected.filter((s) => s !== name));

  return (
    <div>
      <input value={query} onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && suggestions[0]) { e.preventDefault(); add(suggestions[0].name); }
        }}
        placeholder="Escribe un ingrediente que tengas…"
        style={{
          width: '100%', padding: '10px 14px', fontSize: 14,
          background: pal.surface, border: `0.5px solid ${pal.line}`,
          borderRadius: 12, color: pal.ink, outline: 'none',
        }} />
      {suggestions.length > 0 && (
        <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {suggestions.map((it) => (
            <button key={it.id} onClick={() => add(it.name)} style={{
              padding: '6px 12px', borderRadius: 16, cursor: 'pointer',
              background: pal.primarySoft, color: pal.primary,
              border: 'none', fontSize: 12, fontWeight: 600,
            }}>+ {it.emoji || ''} {it.name}</button>
          ))}
        </div>
      )}
      {selected.length > 0 && (
        <div style={{
          marginTop: 10, padding: '10px 12px',
          background: pal.surface, borderRadius: 12, border: `0.5px solid ${pal.line}`,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: pal.inkFaint, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>
            Buscando recetas con
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {selected.map((name) => (
              <button key={name} onClick={() => remove(name)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 10px 6px 12px', borderRadius: 16, cursor: 'pointer',
                background: pal.ink, color: pal.bg,
                border: 'none', fontSize: 12, fontWeight: 600,
              }}>{name}<span style={{ opacity: 0.7, fontSize: 14 }}>×</span></button>
            ))}
          </div>
        </div>
      )}
      {query.trim() && suggestions.length === 0 && (
        <div style={{ marginTop: 6, fontSize: 11, color: pal.inkFaint }}>
          Nada en tu inventario empieza por "{query}". Ajusta o añade items primero.
        </div>
      )}
    </div>
  );
};

const Group = ({ label, children }) => {
  const { pal } = useLF();
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: pal.inkSoft, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
        {label}
      </div>
      {children}
    </div>
  );
};
const ChipsRow = ({ children }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{children}</div>
);
const Chip = ({ pal, active, onClick, children }) => (
  <button onClick={onClick} style={{
    padding: '8px 14px', borderRadius: 16, cursor: 'pointer',
    background: active ? pal.ink : pal.surface,
    color: active ? pal.bg : pal.ink,
    border: `0.5px solid ${active ? pal.ink : pal.line}`,
    fontSize: 12, fontWeight: 600,
  }}>{children}</button>
);
