import React, { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getSetting, setSetting } from '../db.js';
import { useLF } from '../components/ctx.js';
import { suggestRecipes, proxyConfigured } from '../api.js';
import { LF_SHADOWS } from '../tokens/palettes.js';
import LFIcon from '../icons/LFIcon.jsx';
import { create as resourceCreate } from '../api/resources.js';
import { syncHousehold } from '../api/sync.js';
import { toast } from '../components/base.jsx';
import { RecipeThumb } from '../data/recipeThumbs.jsx';

const WELCOME = { role: 'ai', text: '¡Hola! Cuéntame qué te apetece y te propongo recetas con lo que tienes en casa. Pídeme rápido, ligero, dulce, sin cocinar… lo que sea.' };

const QUICK_FILTERS = [
  { id: 'quick', label: '⚡ Rápido', prompt: 'menos de 15 minutos' },
  { id: 'fewdishes', label: '🍽 Pocos cacharros', prompt: 'que ensucie poco' },
  { id: 'sweet', label: '🍰 Dulce', prompt: 'algo dulce' },
  { id: 'salty', label: '🧂 Salado', prompt: 'algo salado' },
  { id: 'light', label: '🥗 Ligero', prompt: 'algo ligero y saludable' },
  { id: 'comfort', label: '🍲 Comfort', prompt: 'comfort food' },
  { id: 'noheat', label: '🥶 Sin cocinar', prompt: 'sin encender el fuego' },
  { id: 'protein', label: '💪 Proteico', prompt: 'alto en proteína' },
];

export default function AntojosChat({ onClose, onOpenRecipe, initialPrompt }) {
  const { pal, fonts, currentHouseholdMeta } = useLF();
  const hid = currentHouseholdMeta?.id;
  const [messages, setMessages] = useState([WELCOME]);
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState('');
  const [filters, setFilters] = useState({});
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);
  const initialFiredRef = useRef(false);
  const items = useLiveQuery(
    () => hid ? db.items.where({ householdId: hid }).toArray() : Promise.resolve([]),
    [hid], []
  );
  const recipes = useLiveQuery(
    () => hid ? db.recipes.where({ householdId: hid }).toArray() : Promise.resolve([]),
    [hid], []
  );

  // Hidratar historial guardado
  useEffect(() => {
    if (!hid) return;
    let cancelled = false;
    (async () => {
      const saved = await getSetting(`antojos:${hid}`);
      if (!cancelled && Array.isArray(saved) && saved.length) setMessages(saved);
      if (!cancelled) setHydrated(true);
    })();
    return () => { cancelled = true; };
  }, [hid]);

  // Persistir cada vez que cambia (sólo si ya hidratamos para no machacar el historial al boot)
  useEffect(() => {
    if (!hid || !hydrated) return;
    setSetting(`antojos:${hid}`, messages).catch(() => {});
  }, [messages, hid, hydrated]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  // Auto-envío del initialPrompt cuando aterrizamos con uno (p.ej. desde "úsalos ya").
  // Esperamos a que el inventario esté cargado y a que el historial se haya hidratado.
  useEffect(() => {
    if (!initialPrompt || initialFiredRef.current) return;
    if (!hydrated) return;
    if (!Array.isArray(items)) return;
    initialFiredRef.current = true;
    // Pequeño delay para que el render del chat se estabilice
    setTimeout(() => { send(initialPrompt); }, 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt, hydrated, items]);

  const clearHistory = async () => {
    if (!confirm('¿Borrar todo el historial de antojos?')) return;
    setMessages([WELCOME]);
    if (hid) await setSetting(`antojos:${hid}`, [WELCOME]);
  };

  const toggleFilter = (id) => setFilters((f) => ({ ...f, [id]: !f[id] }));

  const send = async (overrideText) => {
    const activeFilters = Object.entries(filters).filter(([, v]) => v).map(([k]) => k);
    const filterPrompts = activeFilters.map((id) => QUICK_FILTERS.find((f) => f.id === id)?.prompt).filter(Boolean);
    const userText = (overrideText ?? input).trim();
    if (!userText && filterPrompts.length === 0) return;

    const fullUser = [userText, filterPrompts.length ? `(restricciones: ${filterPrompts.join(', ')})` : ''].filter(Boolean).join(' ');
    setMessages((m) => [...m, { role: 'user', text: fullUser }]);
    setInput('');
    setBusy(true);

    if (!proxyConfigured()) {
      setMessages((m) => [...m, { role: 'ai', text: 'Configura VITE_API_PROXY_URL en .env y despliega el worker para que pueda pensar 🤖' }]);
      setBusy(false);
      return;
    }

    try {
      const inv = items.map((it) => {
        const qty = it.type === 'continuous' ? `${it.fill}% (${it.unit})` : `${it.qty} ${it.unit}`;
        const exp = it.expires <= 5 ? ` ⚠ caduca en ${it.expires}d` : '';
        return `- ${it.name}: ${qty}${exp}`;
      }).join('\n');

      const res = await suggestRecipes({ inventory: inv, userPrompt: fullUser });
      if (res?.recipes?.length) {
        setMessages((m) => [...m, { role: 'ai', intro: res.intro, recipes: res.recipes }]);
      } else {
        setMessages((m) => [...m, { role: 'ai', text: 'No he sacado ideas claras. ¿Probamos otra cosa?' }]);
      }
    } catch (e) {
      const msg = String(e?.message || '');
      const friendly = msg.includes('429')
        ? 'Demasiadas peticiones seguidas. Espera ~1 minuto y vuelve a probar 🐢'
        : 'Ups, no he podido conectar. Inténtalo de nuevo en un momento.';
      setMessages((m) => [...m, { role: 'ai', text: friendly }]);
    } finally {
      setBusy(false);
      setFilters({});
    }
  };

  const matchExisting = (name) => {
    const lower = (name || '').toLowerCase();
    const first = lower.split(' ')[0];
    return recipes.find((r) => r.name.toLowerCase().includes(first) || lower.includes(r.name.toLowerCase().split(' ')[0]));
  };

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 50,
      background: 'rgba(20,25,18,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-end',
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', height: '92%',
        background: pal.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        animation: 'slideUp .28s cubic-bezier(.3,.7,.4,1)',
      }}>
        <div style={{ padding: '10px 0 4px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: pal.lineStrong }}/>
        </div>
        <div style={{ padding: '4px 18px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 18,
              background: pal.primarySoft,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <LFIcon name="sparkle" size={18} color={pal.primary} strokeWidth={2.2} />
            </div>
            <div>
              <div style={{ fontFamily: fonts.display, fontSize: 16, fontWeight: 700, color: pal.ink, lineHeight: 1.1 }}>¿Antojos?</div>
              <div style={{ fontSize: 11, color: pal.inkSoft }}>Recetas con lo que tienes</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {messages.length > 1 && (
              <button onClick={clearHistory} title="Borrar historial" style={{
                background: 'transparent', border: 'none', color: pal.inkFaint,
                fontSize: 16, padding: '4px 8px', cursor: 'pointer',
              }}>🗑</button>
            )}
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: pal.inkSoft, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cerrar</button>
          </div>
        </div>

        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '8px 18px 12px' }}>
          {messages.map((m, i) => (
            <ChatBubble key={i} msg={m} hid={hid} matchExisting={matchExisting} onOpenRecipe={onOpenRecipe} onClose={onClose} />
          ))}
          {busy && <ChatBubble msg={{ role: 'ai', typing: true }} />}
        </div>

        <div style={{
          padding: '6px 18px 8px', display: 'flex', gap: 6, overflowX: 'auto',
          borderTop: `0.5px solid ${pal.line}`, background: pal.surface,
        }}>
          {QUICK_FILTERS.map((f) => {
            const active = !!filters[f.id];
            return (
              <button key={f.id} onClick={() => toggleFilter(f.id)} style={{
                flexShrink: 0, padding: '6px 12px', borderRadius: 999,
                background: active ? pal.ink : pal.bg,
                color: active ? pal.bg : pal.inkSoft,
                border: `0.5px solid ${active ? pal.ink : pal.line}`,
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}>{f.label}</button>
            );
          })}
        </div>

        <div style={{
          padding: '10px 14px 16px', display: 'flex', gap: 8, alignItems: 'flex-end',
          background: pal.surface, borderTop: `0.5px solid ${pal.line}`,
        }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Me apetece algo cremoso y rapidito…"
            rows={1}
            style={{
              flex: 1, resize: 'none', border: 'none',
              background: pal.bg, borderRadius: 18,
              padding: '12px 14px', fontSize: 14,
              color: pal.ink, outline: 'none',
              borderBottom: `0.5px solid ${pal.line}`,
              fontFamily: fonts.body, lineHeight: 1.3, maxHeight: 100,
            }}
          />
          <button onClick={send} disabled={busy} style={{
            width: 44, height: 44, borderRadius: 22, flexShrink: 0,
            background: busy ? pal.lineStrong : pal.primary,
            border: 'none', cursor: busy ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', boxShadow: LF_SHADOWS.md,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

const ChatBubble = ({ msg, hid, matchExisting, onOpenRecipe, onClose }) => {
  const { pal } = useLF();
  const isUser = msg.role === 'user';
  const align = isUser ? 'flex-end' : 'flex-start';

  if (msg.typing) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 10 }}>
        <div style={{
          background: pal.surface, borderRadius: 16, borderBottomLeftRadius: 4,
          padding: '10px 14px', display: 'flex', gap: 4,
          border: `0.5px solid ${pal.line}`,
        }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{
              width: 6, height: 6, borderRadius: 3, background: pal.inkSoft,
              animation: `pulse 1.2s ${i * 0.15}s infinite ease-in-out`,
            }}/>
          ))}
          <style>{`@keyframes pulse { 0%, 80%, 100% { opacity: 0.3; } 40% { opacity: 1; } }`}</style>
        </div>
      </div>
    );
  }

  if (!isUser && msg.recipes) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginBottom: 12, gap: 8 }}>
        {msg.intro && (
          <div style={{
            background: pal.surface, borderRadius: 16, borderBottomLeftRadius: 4,
            padding: '10px 14px', maxWidth: '85%',
            border: `0.5px solid ${pal.line}`, fontSize: 13, color: pal.ink, lineHeight: 1.4,
          }}>{msg.intro}</div>
        )}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {msg.recipes.map((r, i) => (
            <AISuggestionCard key={i} recipe={r} hid={hid} matchExisting={matchExisting} onOpenRecipe={onOpenRecipe} onClose={onClose} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: align, marginBottom: 10 }}>
      <div style={{
        background: isUser ? pal.primary : pal.surface,
        color: isUser ? '#fff' : pal.ink,
        borderRadius: 16,
        borderBottomRightRadius: isUser ? 4 : 16,
        borderBottomLeftRadius: isUser ? 16 : 4,
        padding: '10px 14px', maxWidth: '85%',
        border: isUser ? 'none' : `0.5px solid ${pal.line}`,
        fontSize: 13, lineHeight: 1.4, whiteSpace: 'pre-wrap',
      }}>{msg.text}</div>
    </div>
  );
};

const AISuggestionCard = ({ recipe, hid, matchExisting, onOpenRecipe, onClose }) => {
  const { pal } = useLF();
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleView = () => {
    const m = matchExisting && matchExisting(recipe.name);
    if (m && onOpenRecipe) {
      onClose && onClose();
      onOpenRecipe(m.id);
    } else {
      // Si no hay receta guardada que coincida, mostramos el preview con la info IA
      setShowPreview(true);
    }
  };

  const handleSave = async () => {
    if (saving || !hid) return;
    setSaving(true);
    try {
      const created = await resourceCreate('recipes', hid, {
        name: recipe.name,
        time: Number(recipe.time) || 15,
        effort: Math.max(1, (recipe.tools || []).length),
        img: recipe.img || 'pasta',
        group: 'yours',
        author: 'ia',
      });
      await resourceCreate('recipeDetails', hid, {
        matchName: recipe.name,
        name: recipe.name,
        time: Number(recipe.time) || 15,
        effort: Math.max(1, (recipe.tools || []).length),
        servings: 2,
        img: recipe.img || 'pasta',
        desc: recipe.why || `${recipe.name} con lo que tienes en casa.`,
        ingredients: (recipe.uses || []).map((name) => ({ name, qty: '', unit: '', itemId: null })),
        steps: recipe.steps || [],
        tools: recipe.tools || [],
      });
      await syncHousehold(hid);
      toast('Guardada en "Tus recetas" 💾');
      if (onOpenRecipe && created?.id) {
        onClose && onClose();
        onOpenRecipe(created.id);
      }
    } catch (e) { toast(e?.message || 'Error', 'error'); }
    finally { setSaving(false); }
  };

  return (
    <>
      <div style={{
        background: pal.surface, borderRadius: 14,
        border: `0.5px solid ${pal.line}`, boxShadow: LF_SHADOWS.sm, overflow: 'hidden',
      }}>
        <div style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: pal.ink, lineHeight: 1.2 }}>{recipe.name}</div>
            {recipe.time && (
              <div style={{ fontSize: 11, color: pal.inkSoft, flexShrink: 0 }}>⏱ {recipe.time}m</div>
            )}
          </div>
          {recipe.why && (
            <div style={{ fontSize: 12, color: pal.inkSoft, marginTop: 4, lineHeight: 1.4 }}>{recipe.why}</div>
          )}
          {recipe.uses && recipe.uses.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
              {recipe.uses.map((ing, i) => (
                <span key={i} style={{
                  fontSize: 10, fontWeight: 600,
                  padding: '3px 8px', borderRadius: 8,
                  background: pal.primarySoft, color: pal.primary,
                }}>{ing}</span>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            <button onClick={handleView} style={{
              flex: 1, padding: '8px 10px', borderRadius: 10,
              background: pal.ink, color: pal.bg, border: 'none',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>Ver receta</button>
            <button onClick={handleSave} disabled={saving} style={{
              padding: '8px 12px', borderRadius: 10,
              background: pal.bg, color: pal.ink,
              border: `0.5px solid ${pal.line}`,
              fontSize: 12, fontWeight: 600, cursor: saving ? 'default' : 'pointer',
            }}>{saving ? '…' : 'Guardar'}</button>
          </div>
        </div>
      </div>
      {showPreview && (
        <AntojosPreviewModal recipe={recipe} hid={hid}
          onSave={async () => { await handleSave(); setShowPreview(false); }}
          onClose={() => setShowPreview(false)} />
      )}
    </>
  );
};

const AntojosPreviewModal = ({ recipe, hid, onSave, onClose }) => {
  const { pal, fonts } = useLF();
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 70,
      background: 'rgba(20,25,18,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-end',
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxHeight: '92%', background: pal.bg,
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
              display: 'inline-flex', padding: '3px 8px',
              background: pal.primarySoft, color: pal.primary,
              borderRadius: 8, fontSize: 10, fontWeight: 700, marginBottom: 8,
            }}>✨ Sugerencia IA</div>
            <h1 style={{ fontFamily: fonts.display, fontSize: 24, fontWeight: 700, color: pal.ink, margin: 0 }}>
              {recipe.name}
            </h1>
            <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 13, color: pal.inkSoft }}>
              {recipe.time != null && <span>⏱ {recipe.time} min</span>}
              {recipe.tools?.length > 0 && <span>🍳 {recipe.tools.length}</span>}
            </div>
            {recipe.why && (
              <p style={{ fontSize: 13, color: pal.inkSoft, marginTop: 12, lineHeight: 1.5 }}>{recipe.why}</p>
            )}

            {recipe.uses?.length > 0 && (
              <>
                <SectionLabel pal={pal}>Ingredientes</SectionLabel>
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
                <SectionLabel pal={pal}>Pasos</SectionLabel>
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
                <SectionLabel pal={pal}>A fregar luego</SectionLabel>
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
          <button onClick={onSave} style={{
            flex: 2, padding: 14, background: pal.primary, color: '#fff',
            border: 'none', borderRadius: 14,
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}>💾 Guardar como mi receta</button>
        </div>
      </div>
    </div>
  );
};

const SectionLabel = ({ pal, children }) => (
  <div style={{
    fontSize: 11, fontWeight: 700, color: pal.inkSoft,
    letterSpacing: '0.04em', textTransform: 'uppercase',
    marginTop: 18, marginBottom: 8,
  }}>{children}</div>
);
