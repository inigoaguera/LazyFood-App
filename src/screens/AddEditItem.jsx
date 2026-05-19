import React, { useEffect, useRef, useState } from 'react';
import { useLF, haptic } from '../components/ctx.js';
import { useCategories } from '../util/categories.js';
import { LF_SHADOWS } from '../tokens/palettes.js';
import { Card, Chip, toast } from '../components/base.jsx';
import LFIcon from '../icons/LFIcon.jsx';
import { create as resourceCreate, patch as resourcePatch, remove as resourceRemove } from '../api/resources.js';
import { suggestedExpiresAt, daysToTs, expiryStatus, DAY_MS } from '../util/expires.js';

export default function AddEditModal({ item, defaults, onClose, onSaved, zIndex = 50 }) {
  const { pal, fonts, settings, currentHouseholdMeta } = useLF();
  const hid = currentHouseholdMeta?.id;
  const allCategories = useCategories(hid);
  const variant = settings.gaugeVariant || 'bottle';
  const [data, setData] = useState(() => {
    if (item) return { shape: item.shape || variant, ...item };
    const base = {
      name: '', emoji: '🥫', cat: 'conserva', loc: 'pantry',
      type: 'continuous', fill: 100, qty: 1, unit: 'ud',
      shape: variant,
      ...(defaults || {}),
    };
    // Caducidad sugerida según cat+loc
    if (base.expiresAt === undefined) {
      base.expiresAt = suggestedExpiresAt(base.cat, base.loc);
    }
    base.frozenAt = base.frozenAt ?? null;
    base.openedAt = base.openedAt ?? null;
    return base;
  });
  const update = (k, v) => setData((d) => ({ ...d, [k]: v }));

  const save = async () => {
    if (!data.name.trim()) { toast('Pon un nombre primero', 'error'); return; }
    if (!hid) { toast('Sin casa activa', 'error'); return; }
    const payload = { ...data };
    if (payload.type === 'continuous') delete payload.qty; else delete payload.fill;
    // Eliminamos campos de cache local que no son del backend
    delete payload.householdId; delete payload.updated_at; delete payload.deleted_at;
    // Legacy: ya no usamos `expires` (días estáticos). Mandamos solo expiresAt.
    delete payload.expires;
    try {
      let savedItem;
      if (item?.id) {
        await resourcePatch('items', hid, item.id, payload);
        savedItem = { ...item, ...payload };
        toast('Cambios guardados');
      } else {
        const { id: _, ...toSave } = payload;
        savedItem = await resourceCreate('items', hid, toSave);
        toast(`${data.name} añadido`);
      }
      haptic(15);
      onSaved?.(savedItem);
    } catch (e) {
      toast(e?.message || 'No se pudo guardar', 'error');
    }
  };

  // ─── Acciones rápidas para caducidad ─────────────────────────────
  const setExpiresInDays = (days) => {
    update('expiresAt', daysToTs(days));
    update('openedAt', null);
  };
  const setNoExpiry = () => update('expiresAt', null);
  const handleOpen = () => {
    const now = Date.now();
    update('openedAt', now);
    update('expiresAt', suggestedExpiresAt(data.cat, data.loc, now, now));
    toast('Caducidad arrancada desde hoy');
  };

  const expState = expiryStatus(data);

  const remove = async () => {
    if (!item?.id || !hid) return;
    try {
      await resourceRemove('items', hid, item.id);
      toast(`${item.name} eliminado`);
      onClose();
    } catch (e) { toast(e?.message || 'Error', 'error'); }
  };

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex,
      background: 'rgba(20,25,18,0.45)', backdropFilter: 'blur(4px)',
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
        <div style={{ padding: '4px 20px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: pal.inkSoft, fontSize: 14, cursor: 'pointer', padding: 0 }}>Cancelar</button>
          <div style={{ fontFamily: fonts.body, fontSize: 15, fontWeight: 600 }}>{item ? 'Editar' : 'Añadir'}</div>
          <button onClick={save} style={{ background: 'transparent', border: 'none', color: pal.primary, fontSize: 14, fontWeight: 700, cursor: 'pointer', padding: 0 }}>Guardar</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 40px' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 18 }}>
            <EmojiPicker emoji={data.emoji} onChange={(e) => update('emoji', e)} />
            <input value={data.name} onChange={(e) => update('name', e.target.value)}
              placeholder="Nombre del alimento"
              style={{
                flex: 1, border: 'none', background: pal.surface,
                borderRadius: 14, padding: '14px 16px', fontSize: 17, fontWeight: 600,
                color: pal.ink, boxShadow: LF_SHADOWS.sm, outline: 'none',
                borderBottom: `0.5px solid ${pal.line}`,
              }}/>
          </div>

          <div style={{ marginBottom: 20 }}>
            <SectionLabel>Cantidad</SectionLabel>
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', padding: 6, gap: 4, background: pal.bg }}>
                {[
                  { id: 'continuous', label: '📏 Continuo', sub: 'arroz, leche, aceite…' },
                  { id: 'discrete',   label: '🔢 Unidades', sub: 'huevos, tomates…' },
                ].map((t) => (
                  <button key={t.id} onClick={() => update('type', t.id)} style={{
                    flex: 1, padding: '10px 12px', borderRadius: 12,
                    background: data.type === t.id ? pal.surface : 'transparent',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                    boxShadow: data.type === t.id ? LF_SHADOWS.sm : 'none',
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: pal.ink }}>{t.label}</div>
                    <div style={{ fontSize: 10, color: pal.inkFaint, marginTop: 2 }}>{t.sub}</div>
                  </button>
                ))}
              </div>
              <div style={{ padding: 20 }}>
                {data.type === 'continuous' ? (
                  <>
                    <ShapePicker value={data.shape || variant} onChange={(v) => update('shape', v)} />
                    <LiquidGauge value={data.fill ?? 100} onChange={(v) => update('fill', v)} unit={data.unit} variant={data.shape || variant} />
                    <UnitPicker units={['L', 'kg', 'g', 'ud']} value={data.unit} onChange={(v) => update('unit', v)} />
                  </>
                ) : (
                  <>
                    <Stepper value={data.qty ?? 1} onChange={(v) => update('qty', v)} unit={data.unit} />
                    <UnitPicker units={['uds', 'latas', 'paquetes']} value={data.unit} onChange={(v) => update('unit', v)} />
                  </>
                )}
              </div>
            </Card>
          </div>

          <SectionLabel>Ubicación</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 18 }}>
            {[
              { id: 'fridge',  label: 'Nevera',     emoji: '🧊', color: pal.fridge },
              { id: 'freezer', label: 'Congelador', emoji: '❄️', color: pal.freezer },
              { id: 'pantry',  label: 'Despensa',   emoji: '🫙', color: pal.pantry },
            ].map((l) => (
              <button key={l.id} onClick={() => update('loc', l.id)} style={{
                padding: '14px 8px', borderRadius: 14,
                background: data.loc === l.id ? l.color : pal.surface,
                border: `1.5px solid ${data.loc === l.id ? pal.ink : pal.line}`,
                cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              }}>
                <span style={{ fontSize: 22 }}>{l.emoji}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: pal.ink }}>{l.label}</span>
              </button>
            ))}
          </div>

          <SectionLabel>Categoría</SectionLabel>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
            {allCategories.map((c) => (
              <Chip key={c.id} label={c.label} color={c.color} active={data.cat === c.id} onClick={() => update('cat', c.id)} />
            ))}
          </div>

          <SectionLabel>Caduca</SectionLabel>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <LFIcon name="calendar" size={20} color={pal.primary} />
                <span style={{ fontSize: 14, color: pal.ink, fontWeight: 600 }}>
                  {data.frozenAt != null ? '🧊 congelado' : expState.label}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {[3, 7, 30, 90].map((d) => (
                  <button key={d} onClick={() => setExpiresInDays(d)} style={{
                    padding: '6px 10px', borderRadius: 10,
                    background: pal.bg, color: pal.inkSoft,
                    border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  }}>{d}d</button>
                ))}
                <button onClick={setNoExpiry} style={{
                  padding: '6px 10px', borderRadius: 10,
                  background: data.expiresAt == null ? pal.ink : pal.bg,
                  color: data.expiresAt == null ? pal.bg : pal.inkSoft,
                  border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                }}>—</button>
              </div>
            </div>
            {/* Botón "Abrir" para conservas/items sin caducidad activa */}
            {data.expiresAt == null && data.openedAt == null && item?.id && (
              <button onClick={handleOpen} style={{
                marginTop: 10, width: '100%', padding: 10, borderRadius: 10,
                background: pal.primarySoft, color: pal.primary, border: 'none',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>
                📦 Abrir — arranca el contador de caducidad
              </button>
            )}
            {data.openedAt && (
              <div style={{ marginTop: 8, fontSize: 11, color: pal.inkSoft }}>
                Abierto el {new Date(data.openedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
              </div>
            )}
          </Card>

          {item?.id && (
            <button onClick={remove} style={{
              marginTop: 22, width: '100%', padding: 14,
              background: 'transparent', border: `1px solid ${pal.dangerSoft}`,
              borderRadius: 14, color: pal.danger, fontSize: 14, fontWeight: 600,
              cursor: 'pointer',
            }}>Eliminar alimento</button>
          )}
        </div>
      </div>
    </div>
  );
}

const SectionLabel = ({ children }) => {
  const { pal } = useLF();
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: pal.inkFaint,
      letterSpacing: '0.08em', textTransform: 'uppercase',
      marginBottom: 8, marginTop: 4,
    }}>{children}</div>
  );
};

const COMMON_EMOJIS = ['🥛','🥚','🥬','🍅','🥕','🍗','🐟','🍞','🍝','🍚','🫒','🫘','☕','🧂','🧅','🍎','🍌','🧀','🍦','🦐','🍨','🫛','🥑','🥩','🥒','🌶️','🍆','🫑','🌽','🥔','🧄','🍋','🥝','🍇','🍓','🥥','🥦','🥯','🥨','🍫','🍪','🥫','🥤'];

const EmojiPicker = ({ emoji, onChange }) => {
  const { pal } = useLF();
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen((v) => !v)} style={{
        width: 64, height: 64, borderRadius: 20, border: `0.5px solid ${pal.line}`,
        background: pal.surface, boxShadow: LF_SHADOWS.sm,
        fontSize: 32, cursor: 'pointer',
      }}>{emoji}</button>
      {open && (
        <div style={{
          position: 'absolute', top: 70, left: 0, zIndex: 5,
          background: pal.surface, borderRadius: 14, boxShadow: LF_SHADOWS.lg,
          border: `0.5px solid ${pal.line}`, padding: 8,
          width: 240, maxHeight: 200, overflowY: 'auto',
          display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4,
        }}>
          {COMMON_EMOJIS.map((e) => (
            <button key={e} onClick={() => { onChange(e); setOpen(false); }} style={{
              fontSize: 22, padding: 4, border: 'none', background: 'transparent', cursor: 'pointer',
              borderRadius: 6,
            }}>{e}</button>
          ))}
        </div>
      )}
    </div>
  );
};

const UnitPicker = ({ units, value, onChange }) => {
  const { pal } = useLF();
  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 12, justifyContent: 'center' }}>
      {units.map((u) => (
        <button key={u} onClick={() => onChange(u)} style={{
          padding: '6px 14px', borderRadius: 10,
          background: value === u ? pal.ink : pal.bg,
          color: value === u ? pal.bg : pal.inkSoft,
          border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer',
        }}>{u}</button>
      ))}
    </div>
  );
};

const ShapePicker = ({ value, onChange }) => {
  const { pal } = useLF();
  const SHAPES = [
    { id: 'bottle', label: 'Botella', icon: 'M9 2h6v3c0 1 2 1 2 4v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V9c0-3 2-3 2-4z' },
    { id: 'jar',    label: 'Tarro',   icon: 'M5 4h14v3h-1v13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7H5z' },
    { id: 'sack',   label: 'Saco',    icon: 'M7 5l-1-2h12l-1 2 2 3v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8z' },
  ];
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 14, padding: 4, background: pal.bg, borderRadius: 12 }}>
      {SHAPES.map((s) => {
        const active = value === s.id;
        return (
          <button key={s.id} onClick={() => onChange(s.id)} style={{
            flex: 1, padding: '8px 6px', borderRadius: 9,
            background: active ? pal.surface : 'transparent',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            boxShadow: active ? LF_SHADOWS.sm : 'none',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke={active ? pal.primary : pal.inkSoft} strokeWidth="1.8" strokeLinejoin="round">
              <path d={s.icon} />
            </svg>
            <span style={{ fontSize: 11, fontWeight: 600, color: active ? pal.ink : pal.inkSoft }}>{s.label}</span>
          </button>
        );
      })}
    </div>
  );
};

const SILHOUETTES = {
  bottle: { w: 120, h: 220, clip: 'M45 0 L45 30 Q30 36 30 55 L30 210 Q30 220 40 220 L80 220 Q90 220 90 210 L90 55 Q90 36 75 30 L75 0 Z' },
  jar:    { w: 140, h: 200, clip: 'M15 0 L125 0 L125 30 L120 30 L120 190 Q120 200 110 200 L30 200 Q20 200 20 190 L20 30 L15 30 Z' },
  sack:   { w: 160, h: 200, clip: 'M30 20 L130 20 L135 10 L25 10 L30 20 L20 40 L20 180 Q20 200 40 200 L120 200 Q140 200 140 180 L140 40 Z' },
};

const LiquidGauge = ({ value, onChange, unit, variant = 'bottle' }) => {
  const { pal, fonts } = useLF();
  const ref = useRef(null);
  const [dragging, setDragging] = useState(false);
  const sil = SILHOUETTES[variant] || SILHOUETTES.bottle;
  const color = value < 20 ? pal.danger : value < 40 ? pal.accent : pal.primary;

  const updateFromY = (clientY) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const y = clientY - rect.top;
    const pct = Math.max(0, Math.min(100, 100 - (y / rect.height) * 100));
    onChange(Math.round(pct));
  };
  const onDown = (clientY) => { setDragging(true); updateFromY(clientY); haptic(); };
  useEffect(() => {
    if (!dragging) return;
    const mm = (e) => updateFromY(e.clientY);
    const mu = () => setDragging(false);
    const tm = (e) => updateFromY(e.touches[0].clientY);
    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup', mu);
    window.addEventListener('touchmove', tm);
    window.addEventListener('touchend', mu);
    return () => {
      window.removeEventListener('mousemove', mm);
      window.removeEventListener('mouseup', mu);
      window.removeEventListener('touchmove', tm);
      window.removeEventListener('touchend', mu);
    };
  }, [dragging]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
      <div ref={ref}
        onMouseDown={(e) => onDown(e.clientY)}
        onTouchStart={(e) => onDown(e.touches[0].clientY)}
        style={{
          width: sil.w, height: sil.h, position: 'relative',
          cursor: dragging ? 'grabbing' : 'ns-resize',
          flexShrink: 0, userSelect: 'none', touchAction: 'none',
        }}>
        <svg viewBox={`0 0 ${sil.w} ${sil.h}`} style={{ position: 'absolute', inset: 0 }}>
          <defs>
            <clipPath id={`clip-${variant}`}><path d={sil.clip}/></clipPath>
          </defs>
          <path d={sil.clip} fill={pal.bg} stroke={pal.ink} strokeWidth="2.5" strokeLinejoin="round"/>
          <g clipPath={`url(#clip-${variant})`}>
            <rect x="0" y={sil.h * (1 - value / 100)} width={sil.w} height={sil.h} fill={color} opacity="0.9"/>
            <path d={`M0 ${sil.h * (1 - value / 100)} Q ${sil.w / 4} ${sil.h * (1 - value / 100) - 4}, ${sil.w / 2} ${sil.h * (1 - value / 100)} T ${sil.w} ${sil.h * (1 - value / 100)} L ${sil.w} ${sil.h} L 0 ${sil.h} Z`} fill={color}/>
          </g>
          <line x1="10" y1={sil.h * (1 - value / 100)} x2={sil.w - 10} y2={sil.h * (1 - value / 100)}
            stroke="white" strokeWidth="1.5" strokeDasharray="3 3" opacity={dragging ? 1 : 0.5}/>
        </svg>
        <div style={{
          position: 'absolute', right: -18, top: 0, bottom: 0,
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          padding: '4px 0', fontSize: 9, color: pal.inkFaint, fontFamily: fonts.mono,
        }}>
          <span>100</span><span>75</span><span>50</span><span>25</span><span>0</span>
        </div>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{
          fontFamily: fonts.display, fontSize: 54, fontWeight: 800,
          color: pal.ink, lineHeight: 1, letterSpacing: '-0.03em',
        }}>{value}<span style={{ fontSize: 24, color: pal.inkSoft, fontWeight: 600 }}>%</span></div>
        <div style={{ fontSize: 13, color: pal.inkSoft, marginTop: 4 }}>
          Aprox. {Math.round(value * 0.01 * 100) / 100} {unit}
        </div>
        <div style={{
          marginTop: 14, padding: 10, background: pal.primarySoft, borderRadius: 10,
          fontSize: 11, color: pal.primary, lineHeight: 1.4,
        }}>
          💡 Desliza sobre el envase para marcar cuánto queda
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 4 }}>
          {[0, 25, 50, 75, 100].map((v) => (
            <button key={v} onClick={() => onChange(v)} style={{
              flex: 1, padding: '6px 0', borderRadius: 8, border: 'none',
              background: value === v ? pal.ink : pal.bg,
              color: value === v ? pal.bg : pal.inkSoft,
              fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}>{v}</button>
          ))}
        </div>
      </div>
    </div>
  );
};

// Stepper con paso 1 (clic normal) y paso 0.25 (long press / shift). Para
// items discretos divisibles (huevos por mitades, latas por cuartos…).
// Doble pulsación rápida en + o − activa el paso fino en esa pulsación.
const Stepper = ({ value, onChange, unit }) => {
  const { pal, fonts } = useLF();
  const [fineMode, setFineMode] = React.useState(false);
  const step = fineMode ? 0.25 : 1;
  // Mostramos enteros sin decimales, fracciones con 2 decimales.
  const display = Number.isInteger(value) ? value : Number(value).toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 0', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <button onClick={() => { haptic(); onChange(Math.max(0, +(value - step).toFixed(2))); }} style={{
          width: 56, height: 56, borderRadius: 28,
          background: pal.bg, border: `0.5px solid ${pal.line}`,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <LFIcon name="minus" size={24} color={pal.ink} strokeWidth={2.4} />
        </button>
        <div style={{ textAlign: 'center', minWidth: 140 }}>
          <div style={{ fontFamily: fonts.display, fontSize: 62, fontWeight: 800, color: pal.ink, lineHeight: 1, letterSpacing: '-0.03em' }}>{display}</div>
          <div style={{ fontSize: 13, color: pal.inkSoft, marginTop: 2 }}>{unit}</div>
        </div>
        <button onClick={() => { haptic(); onChange(+(value + step).toFixed(2)); }} style={{
          width: 56, height: 56, borderRadius: 28,
          background: pal.primary, color: '#fff', border: 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: LF_SHADOWS.md,
        }}>
          <LFIcon name="plus" size={24} color="#fff" strokeWidth={2.4} />
        </button>
      </div>
      <button onClick={() => setFineMode((f) => !f)} style={{
        padding: '4px 10px', borderRadius: 12,
        background: fineMode ? pal.primarySoft : 'transparent',
        color: fineMode ? pal.primary : pal.inkFaint,
        border: `0.5px solid ${fineMode ? pal.primary : pal.line}`,
        fontSize: 11, fontWeight: 600, cursor: 'pointer',
      }}>
        {fineMode ? '🔬 paso 0.25' : 'paso 1 · toca para 0.25'}
      </button>
    </div>
  );
};
