import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLF } from '../components/ctx.js';
import { db } from '../db.js';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button, toast } from '../components/base.jsx';
import { LF_SHADOWS } from '../tokens/palettes.js';
import { create as resourceCreate, patch as resourcePatch, remove as resourceRemove } from '../api/resources.js';
import { syncHousehold } from '../api/sync.js';
import { RECIPE_THUMBS } from '../data/recipeThumbs.jsx';
import AddEditModal from './AddEditItem.jsx';

const IMG_OPTIONS = Object.entries(RECIPE_THUMBS);
const GROUPS = [
  { id: 'yours', label: 'Tus recetas' },
  { id: 'effortless', label: 'Cero esfuerzo' },
  { id: 'chef', label: 'Modo chef' },
  { id: 'oneOff', label: 'Te falta 1 ingrediente' },
];

export default function RecipeEditor({ recipeId, hid, onClose, onSaved }) {
  const { pal, fonts } = useLF();
  const editing = !!recipeId;

  const [name, setName] = useState('');
  const [time, setTime] = useState(15);
  const [servings, setServings] = useState(2);
  const [img, setImg] = useState('pasta');
  const [group, setGroup] = useState('yours');
  const [desc, setDesc] = useState('');
  // Ingredient = { name, qty, unit, itemId? }
  const [ingredients, setIngredients] = useState([{ name: '', qty: '', unit: '', itemId: null }]);
  const [steps, setSteps] = useState(['']);
  const [tools, setTools] = useState([]);
  const [busy, setBusy] = useState(false);
  const [existingDetailId, setExistingDetailId] = useState(null);

  // Inventario para el autocomplete de ingredientes
  const inventory = useLiveQuery(
    () => hid ? db.items.where({ householdId: hid }).toArray() : Promise.resolve([]),
    [hid], []
  );

  useEffect(() => {
    if (!editing || !hid) return;
    let cancelled = false;
    (async () => {
      const r = await db.recipes.get(recipeId);
      if (!r || cancelled) return;
      setName(r.name || '');
      setTime(r.time || 15);
      setImg(r.img || 'pasta');
      setGroup(r.group || 'yours');
      const allDetails = await db.recipeDetails.where({ householdId: hid }).toArray();
      const det = allDetails.find((d) => d.matchName === r.name);
      if (det && !cancelled) {
        setExistingDetailId(det.id);
        setServings(det.servings || 2);
        setDesc(det.desc || '');
        setIngredients(det.ingredients?.length
          ? det.ingredients.map((i) => ({ name: i.name || '', qty: i.qty || '', unit: i.unit || '', itemId: i.itemId || null }))
          : [{ name: '', qty: '', unit: '', itemId: null }]);
        setSteps(det.steps?.length ? det.steps : ['']);
        setTools(det.tools || []);
      }
    })();
    return () => { cancelled = true; };
  }, [recipeId, hid, editing]);

  // Refs para enfocar el nuevo paso/instrumento al darle Enter
  const stepRefs = useRef([]);
  const toolRefs = useRef([]);
  const [focusStep, setFocusStep] = useState(null);
  const [focusTool, setFocusTool] = useState(null);
  useEffect(() => {
    if (focusStep != null && stepRefs.current[focusStep]) {
      stepRefs.current[focusStep].focus();
      setFocusStep(null);
    }
  }, [steps.length, focusStep]);
  useEffect(() => {
    if (focusTool != null && toolRefs.current[focusTool]) {
      toolRefs.current[focusTool].focus();
      setFocusTool(null);
    }
  }, [tools.length, focusTool]);

  const addIngredient = () => setIngredients((xs) => [...xs, { name: '', qty: '', unit: '', itemId: null }]);
  const updateIngredient = (i, patch) => setIngredients((xs) => xs.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  const removeIngredient = (i) => setIngredients((xs) => xs.filter((_, idx) => idx !== i));
  const addStep = (focus = false) => {
    const newIdx = steps.length;
    setSteps((xs) => [...xs, '']);
    if (focus) setFocusStep(newIdx);
  };
  const updateStep = (i, val) => setSteps((xs) => xs.map((s, idx) => idx === i ? val : s));
  const removeStep = (i) => setSteps((xs) => xs.filter((_, idx) => idx !== i));
  const addTool = (focus = false) => {
    const newIdx = tools.length;
    setTools((xs) => [...xs, '']);
    if (focus) setFocusTool(newIdx);
  };
  const updateTool = (i, val) => setTools((xs) => xs.map((t, idx) => idx === i ? val : t));
  const removeTool = (i) => setTools((xs) => xs.filter((_, idx) => idx !== i));

  // Esfuerzo se deriva del nº de instrumentos a fregar (mín 1 para no enseñar 0).
  const computedEffort = Math.max(1, tools.filter((t) => t.trim()).length);

  const save = async () => {
    if (!name.trim()) { toast('Ponle un nombre a la receta', 'error'); return; }
    if (!hid) return;
    setBusy(true);
    try {
      const recipePayload = {
        name: name.trim(),
        time: Number(time) || 0,
        effort: computedEffort,
        img, group,
        author: 'tuya',
      };
      let actualRecipeId = recipeId;
      if (editing) {
        await resourcePatch('recipes', hid, recipeId, recipePayload);
      } else {
        const created = await resourceCreate('recipes', hid, recipePayload);
        actualRecipeId = created?.id;
      }

      const cleanIngredients = ingredients.filter((i) => i.name?.trim()).map((i) => ({
        name: i.name.trim(),
        qty: i.qty?.trim() || '',
        unit: i.unit?.trim() || '',
        itemId: i.itemId || null,
      }));
      const cleanSteps = steps.map((s) => s.trim()).filter(Boolean);
      const cleanTools = tools.map((t) => t.trim()).filter(Boolean);

      const detailPayload = {
        matchName: name.trim(),
        name: name.trim(),
        time: Number(time) || 0,
        effort: computedEffort,
        servings: Number(servings) || 2,
        img,
        desc: desc.trim() || `${name.trim()}. Listo en ${time} min.`,
        ingredients: cleanIngredients,
        steps: cleanSteps,
        tools: cleanTools,
      };
      if (existingDetailId) {
        await resourcePatch('recipeDetails', hid, existingDetailId, detailPayload);
      } else {
        await resourceCreate('recipeDetails', hid, detailPayload);
      }

      await syncHousehold(hid);
      toast(editing ? 'Receta actualizada' : 'Receta creada');
      onSaved?.(actualRecipeId);
    } catch (e) {
      toast(e?.message || 'No se pudo guardar', 'error');
    } finally { setBusy(false); }
  };

  const handleDelete = async () => {
    if (!editing || !confirm(`¿Borrar "${name}" para siempre?`)) return;
    try {
      await resourceRemove('recipes', hid, recipeId);
      if (existingDetailId) await resourceRemove('recipeDetails', hid, existingDetailId);
      await syncHousehold(hid);
      toast('Receta borrada');
      onSaved?.(null);
    } catch (e) { toast(e?.message || 'Error', 'error'); }
  };

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 60,
      background: pal.bg, display: 'flex', flexDirection: 'column',
      animation: 'slideUp .28s cubic-bezier(.3,.7,.4,1)',
    }}>
      <div style={{
        padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `0.5px solid ${pal.line}`,
      }}>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: pal.inkSoft, fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
        <div style={{ fontFamily: fonts.display, fontSize: 17, fontWeight: 700, color: pal.ink }}>
          {editing ? 'Editar receta' : 'Nueva receta'}
        </div>
        <button onClick={save} disabled={busy} style={{
          background: 'transparent', border: 'none',
          color: pal.primary, fontSize: 14, fontWeight: 700, cursor: busy ? 'default' : 'pointer',
        }}>{busy ? '…' : 'Guardar'}</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
        <div style={{
          height: 120, borderRadius: 14, marginBottom: 14, overflow: 'hidden',
          background: `linear-gradient(135deg, ${RECIPE_THUMBS[img]?.c[0] || '#E8E4D8'}, ${RECIPE_THUMBS[img]?.c[1] || '#C8C4B8'})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 56,
        }}>
          {RECIPE_THUMBS[img]?.e || '🍽️'}
        </div>

        <Field label="Nombre">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Mi receta favorita"
            style={inputStyle(pal)} />
        </Field>

        <Field label="Imagen">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
            {IMG_OPTIONS.map(([id, t]) => (
              <button key={id} onClick={() => setImg(id)} style={{
                aspectRatio: '1', borderRadius: 10, cursor: 'pointer', fontSize: 22,
                background: `linear-gradient(135deg, ${t.c[0]}, ${t.c[1]})`,
                border: img === id ? `2px solid ${pal.ink}` : `0.5px solid ${pal.line}`,
              }}>{t.e}</button>
            ))}
          </div>
        </Field>

        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <Field label="Tiempo (min)">
              <input type="number" inputMode="numeric" value={time} onChange={(e) => setTime(Number(e.target.value) || 0)}
                style={inputStyle(pal)} />
            </Field>
          </div>
          <div style={{ flex: 1 }}>
            <Field label="Raciones">
              <input type="number" inputMode="numeric" min={1} value={servings} onChange={(e) => setServings(Math.max(1, Number(e.target.value) || 1))}
                style={inputStyle(pal)} />
            </Field>
          </div>
          <div style={{ flex: 1 }}>
            <Field label={`A fregar (${computedEffort})`}>
              <div style={{
                ...inputStyle(pal), display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: pal.surface, color: pal.inkSoft, fontWeight: 700,
              }}>🍳 {computedEffort}</div>
            </Field>
          </div>
        </div>

        <Field label="Sección">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {GROUPS.map((g) => (
              <button key={g.id} onClick={() => setGroup(g.id)} style={{
                padding: '8px 12px', borderRadius: 16, cursor: 'pointer',
                background: group === g.id ? pal.ink : pal.bg,
                color: group === g.id ? pal.bg : pal.inkSoft,
                border: `0.5px solid ${group === g.id ? pal.ink : pal.line}`,
                fontSize: 12, fontWeight: 600,
              }}>{g.label}</button>
            ))}
          </div>
        </Field>

        <Field label="Descripción (opcional)">
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)}
            placeholder="Una línea sobre la receta…" rows={2}
            style={{ ...inputStyle(pal), resize: 'vertical', minHeight: 60 }} />
        </Field>

        {/* Ingredientes — vinculables al inventario */}
        <SectionHeader label={`Ingredientes (${ingredients.filter((i) => i.name?.trim()).length})`} onAdd={addIngredient}
          hint="Toca un sugerido para vincularlo. Si no lo tienes, mándalo a la compra o añádelo al inventario." />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {ingredients.map((ing, i) => (
            <IngredientRow key={i} ing={ing} index={i} inventory={inventory} hid={hid}
              onChange={(p) => updateIngredient(i, p)}
              onRemove={() => removeIngredient(i)} />
          ))}
        </div>

        {/* Pasos */}
        <SectionLabel pal={pal} hint="puede ir vacío · enter para nuevo">
          Pasos ({steps.filter((s) => s.trim()).length})
        </SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 6 }}>
          {steps.map((s, i) => (
            <div key={i} style={{
              display: 'flex', gap: 6, alignItems: 'flex-start',
              padding: 8, background: pal.surface, borderRadius: 10,
              border: `0.5px solid ${pal.line}`,
            }}>
              <span style={{
                flexShrink: 0, width: 22, height: 22, borderRadius: 11,
                background: pal.primary, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, marginTop: 4,
              }}>{i + 1}</span>
              <textarea ref={(el) => { stepRefs.current[i] = el; }}
                value={s} onChange={(e) => updateStep(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addStep(true); }
                }}
                placeholder="Lava los tomates, córtalos por la mitad…" rows={2}
                style={{ flex: 1, padding: 6, fontSize: 13, border: 'none', background: pal.bg, borderRadius: 6, resize: 'vertical', fontFamily: 'inherit' }} />
              <button onClick={() => removeStep(i)} style={{
                background: 'transparent', border: 'none', color: pal.danger, fontSize: 18, cursor: 'pointer', padding: 4,
              }}>×</button>
            </div>
          ))}
        </div>
        <button onClick={addStep} style={addBelowBtn(pal)}>+ Añadir paso</button>

        {/* Tools / instrumentos a fregar */}
        <SectionLabel pal={pal} hint="cada uno suma 1 al icono 🍳 · enter para nuevo">
          Instrumentos a fregar ({tools.filter((t) => t.trim()).length})
        </SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 6 }}>
          {tools.map((t, i) => (
            <div key={i} style={{
              display: 'flex', gap: 6, alignItems: 'center',
              padding: 8, background: pal.surface, borderRadius: 10,
              border: `0.5px solid ${pal.line}`,
            }}>
              <input ref={(el) => { toolRefs.current[i] = el; }}
                value={t} onChange={(e) => updateTool(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); addTool(true); }
                }}
                placeholder="Sartén honda, batidora, tabla…"
                style={{ flex: 1, padding: 6, fontSize: 13, border: 'none', background: pal.bg, borderRadius: 6 }} />
              <button onClick={() => removeTool(i)} style={{
                background: 'transparent', border: 'none', color: pal.danger, fontSize: 18, cursor: 'pointer', padding: 4,
              }}>×</button>
            </div>
          ))}
          {tools.length === 0 && (
            <div style={{ padding: 10, fontSize: 11, color: pal.inkFaint, textAlign: 'center' }}>
              Sin instrumentos = receta limpia
            </div>
          )}
        </div>
        <button onClick={addTool} style={addBelowBtn(pal)}>+ Añadir instrumento</button>
        <div style={{ height: 14 }}/>

        {editing && (
          <button onClick={handleDelete} style={{
            width: '100%', padding: 12, marginTop: 10,
            background: pal.dangerSoft, border: 'none', borderRadius: 12,
            color: pal.danger, fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>
            🗑 Borrar receta
          </button>
        )}
      </div>
    </div>
  );
}

// ─── IngredientRow con autocomplete + acciones para no-vinculados ────
const IngredientRow = ({ ing, inventory, hid, onChange, onRemove }) => {
  const { pal } = useLF();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [addingToInventory, setAddingToInventory] = useState(false);
  const linked = !!ing.itemId;
  const linkedItem = linked ? inventory.find((it) => it.id === ing.itemId) : null;
  const hasName = !!ing.name?.trim();

  const suggestions = useMemo(() => {
    const q = (ing.name || '').trim().toLowerCase();
    if (!q || linked) return [];
    return inventory
      .filter((it) => it.name && it.name.toLowerCase().includes(q))
      .slice(0, 5);
  }, [ing.name, inventory, linked]);

  const pick = (item) => {
    const suggestedUnit = item.unit || (item.type === 'continuous' ? 'g' : 'uds');
    onChange({ name: item.name, itemId: item.id, unit: ing.unit || suggestedUnit });
    setShowSuggestions(false);
  };
  const unlink = () => onChange({ itemId: null });

  const sendToShopping = async () => {
    if (!hid || !hasName) return;
    try {
      const qtyStr = [ing.qty, ing.unit].filter(Boolean).join(' ');
      await resourceCreate('shopping', hid, {
        name: ing.name.trim(), qty: qtyStr, cat: null,
        checked: 0, auto: 1, count: 1,
      });
      await syncHousehold(hid);
      toast(`${ing.name} a la lista de la compra 🛒`);
    } catch (e) { toast(e?.message || 'Error', 'error'); }
  };

  return (
    <div style={{
      padding: 10, background: pal.surface, borderRadius: 10,
      border: `0.5px solid ${linked ? pal.primary : pal.line}`,
    }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {linked && (
          <span title="Vinculado a tu inventario" style={{
            padding: '4px 8px', background: pal.primarySoft, color: pal.primary,
            borderRadius: 8, fontSize: 11, fontWeight: 700, flexShrink: 0,
          }}>
            🔗 {linkedItem?.emoji || ''}
          </span>
        )}
        <input
          value={ing.name}
          onChange={(e) => {
            onChange({ name: e.target.value, itemId: linked ? null : ing.itemId });
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder="Tomate cherry"
          style={{ flex: 2, padding: 6, fontSize: 13, border: 'none', background: pal.bg, borderRadius: 6 }} />
        <input value={ing.qty} onChange={(e) => onChange({ qty: e.target.value })}
          placeholder="200"
          style={{ width: 50, padding: 6, fontSize: 13, border: 'none', background: pal.bg, borderRadius: 6, textAlign: 'center' }} />
        <input value={ing.unit} onChange={(e) => onChange({ unit: e.target.value })}
          placeholder="g"
          style={{ width: 50, padding: 6, fontSize: 13, border: 'none', background: pal.bg, borderRadius: 6 }} />
        <button onClick={onRemove} style={{
          background: 'transparent', border: 'none', color: pal.danger, fontSize: 18, cursor: 'pointer', padding: 4,
        }}>×</button>
      </div>

      {linked && (
        <button onClick={unlink} style={{
          marginTop: 6, padding: '4px 8px', background: 'transparent',
          border: 'none', color: pal.inkSoft, fontSize: 11, cursor: 'pointer',
        }}>Desvincular del inventario</button>
      )}

      {!linked && hasName && suggestions.length === 0 && !showSuggestions && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button onClick={() => setAddingToInventory(true)} style={{
            flex: 1, padding: '6px 10px', borderRadius: 8,
            background: pal.bg, color: pal.ink,
            border: `0.5px solid ${pal.line}`,
            fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}>📥 A inventario</button>
          <button onClick={sendToShopping} style={{
            flex: 1, padding: '6px 10px', borderRadius: 8,
            background: pal.bg, color: pal.ink,
            border: `0.5px solid ${pal.line}`,
            fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}>🛒 A la compra</button>
        </div>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <div style={{
          marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap',
          padding: '6px 4px 2px', borderTop: `0.5px solid ${pal.line}`,
        }}>
          <div style={{ width: '100%', fontSize: 10, color: pal.inkFaint, fontWeight: 600, marginBottom: 4 }}>
            En tu inventario:
          </div>
          {suggestions.map((it) => (
            <button key={it.id} onMouseDown={(e) => { e.preventDefault(); pick(it); }}
              style={{
                padding: '6px 10px', borderRadius: 16, cursor: 'pointer',
                background: pal.primarySoft, color: pal.primary,
                border: 'none', fontSize: 12, fontWeight: 600,
              }}>
              {it.emoji} {it.name}
            </button>
          ))}
        </div>
      )}

      {addingToInventory && (
        <AddEditModal zIndex={70}
          defaults={{
            name: ing.name.trim(),
            qty: Number(ing.qty) || 1,
            unit: ing.unit || 'uds',
          }}
          onClose={() => setAddingToInventory(false)}
          onSaved={(saved) => {
            setAddingToInventory(false);
            if (saved?.id) {
              onChange({ itemId: saved.id, name: saved.name || ing.name });
              toast(`Vinculado a "${saved.name}" 🔗`);
            }
          }} />
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
const SectionHeader = ({ label, onAdd, hint }) => {
  const { pal } = useLF();
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: pal.inkSoft, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</div>
        {hint && <div style={{ fontSize: 10, color: pal.inkFaint, marginTop: 2, lineHeight: 1.3 }}>{hint}</div>}
      </div>
      <button onClick={onAdd} style={{
        background: pal.primarySoft, color: pal.primary, border: 'none',
        borderRadius: 10, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
        marginLeft: 10, flexShrink: 0,
      }}>+ Añadir</button>
    </div>
  );
};

// Cabecera sin botón (cuando el "+" va debajo del último elemento)
const SectionLabel = ({ pal, hint, children }) => (
  <div style={{ marginBottom: 8 }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: pal.inkSoft, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{children}</div>
    {hint && <div style={{ fontSize: 10, color: pal.inkFaint, marginTop: 2, lineHeight: 1.3 }}>{hint}</div>}
  </div>
);

// Botón "+ Añadir" debajo del último elemento de una lista.
const addBelowBtn = (pal) => ({
  width: '100%', padding: '8px 10px', borderRadius: 10,
  background: 'transparent', color: pal.primary,
  border: `1px dashed ${pal.lineStrong}`,
  fontSize: 12, fontWeight: 700, cursor: 'pointer',
  marginBottom: 14,
});
const inputStyle = (pal) => ({
  width: '100%', padding: '12px 14px', fontSize: 15,
  background: pal.surface, border: `1px solid ${pal.line}`,
  borderRadius: 10, color: pal.ink, outline: 'none',
});
