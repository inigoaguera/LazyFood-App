import React, { useEffect, useRef, useState } from 'react';
import { useLF, haptic } from '../components/ctx.js';
import { Header, IconBtn, Button, toast } from '../components/base.jsx';
import { scanReceipt, proxyConfigured } from '../api.js';
import { LF_CATEGORIES } from '../tokens/categories.js';
import LFIcon from '../icons/LFIcon.jsx';
import { create as resourceCreate } from '../api/resources.js';
import { localISODate } from '../util/date.js';
import { daysToTs, suggestedExpiresAt } from '../util/expires.js';

export default function Scanner({ onBack, onDone }) {
  const { pal, fonts, currentHouseholdMeta } = useLF();
  const hid = currentHouseholdMeta?.id;
  const [phase, setPhase] = useState('camera'); // camera | scanning | results | error
  const [stream, setStream] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [detected, setDetected] = useState([]);
  const [meta, setMeta] = useState({ store: null, total: null, savedOnDiscounts: null });
  const videoRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (phase !== 'camera') return;
    let active = true;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } }, audio: false,
        });
        if (!active) { s.getTracks().forEach((t) => t.stop()); return; }
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => {});
        }
      } catch (e) {
        setErrorMsg('No he podido acceder a la cámara. Revisa permisos o sube una foto.');
      }
    })();
    return () => {
      active = false;
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const stopStream = () => {
    if (stream) { stream.getTracks().forEach((t) => t.stop()); setStream(null); }
  };

  const captureFromVideo = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return null;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext('2d').drawImage(v, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.85);
  };

  const handleScan = async (dataUrl) => {
    if (!proxyConfigured()) {
      toast('Configura VITE_API_PROXY_URL para usar el scanner', 'error');
      setPhase('camera');
      return;
    }
    setPhase('scanning');
    try {
      const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
      const result = await scanReceipt({ imageBase64: base64, mimeType: 'image/jpeg' });
      const items = (result.items || []).map((it) => {
        const type = it.type === 'continuous' ? 'continuous' : 'discrete';
        const shape = type === 'continuous'
          ? (['bottle', 'jar', 'sack'].includes(it.shape) ? it.shape : 'bottle')
          : null;
        const unit = it.unit || (type === 'continuous' ? 'L' : 'uds');
        return {
          ...it,
          type, shape, unit,
          loc: ['fridge', 'freezer', 'pantry'].includes(it.loc) ? it.loc : 'pantry',
          // null válido para conservas, especias, etc.
          expiresAt: it.expiresInDays == null ? null : daysToTs(it.expiresInDays),
        };
      });
      setDetected(items);
      setMeta({
        store: result.store, total: result.total,
        savedOnDiscounts: result.savedOnDiscounts, date: result.date,
      });
      setPhase('results');
    } catch (e) {
      toast('No he podido leer el ticket', 'error');
      setPhase('camera');
    }
  };

  const onShutter = () => {
    haptic(15);
    const url = captureFromVideo();
    if (!url) { toast('Cámara aún no lista'); return; }
    stopStream();
    handleScan(url);
  };

  const onPickFile = (e) => {
    const f = e.target.files?.[0];
    // Permite re-elegir la misma foto sin que se "pegue" el input.
    e.target.value = '';
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      stopStream();
      handleScan(reader.result);
    };
    reader.readAsDataURL(f);
  };

  const commit = async () => {
    if (!hid) { toast('Sin casa activa', 'error'); return; }
    let expenseId = null;
    // Si hay total, creamos primero el expense para poder vincular los items.
    if (meta.total != null) {
      try {
        const exp = await resourceCreate('expenses', hid, {
          date: meta.date || localISODate(),
          amount: Number(meta.total),
          store: meta.store || 'Supermercado',
          cat: 'super',
          savedOnDiscounts: meta.savedOnDiscounts != null ? Number(meta.savedOnDiscounts) : null,
        });
        expenseId = exp?.id || null;
      } catch (e) { /* sin expense, igual añadimos items sueltos */ }
    }
    let added = 0;
    for (const d of detected) {
      const cat = ['lacteo', 'verdura', 'fruta', 'carne', 'pescado', 'pasta', 'conserva', 'salsa', 'especia', 'bebida', 'snack', 'congelado'].includes(d.category) ? d.category : 'conserva';
      try {
        const type = d.type === 'continuous' ? 'continuous' : 'discrete';
        await resourceCreate('items', hid, {
          name: d.name, emoji: d.emoji || '🛒', cat,
          loc: d.loc || 'pantry',
          type,
          shape: type === 'continuous' ? (d.shape || 'bottle') : null,
          qty: d.qty != null ? Number(d.qty) : 1,
          fill: type === 'continuous' ? (d.fill ?? 100) : null,
          unit: d.unit || (type === 'continuous' ? 'L' : 'uds'),
          expiresAt: d.expiresAt == null ? null : Number(d.expiresAt),
          price: d.price != null ? Number(d.price) : null,
          expenseId,
        });
        added++;
      } catch (e) { /* sigue con el siguiente */ }
    }
    toast(`${added} items añadidos${expenseId ? ' y ticket registrado' : ''}`);
    onDone?.();
  };

  if (phase === 'camera') {
    return (
      <div style={{ height: '100%', background: '#0a0f08', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <video ref={videoRef} playsInline muted style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
          }}/>
          {!stream && !errorMsg && (
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 30% 40%, #2a3a1a 0%, #0a0f08 70%)' }}/>
          )}
          {errorMsg && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center', padding: 30,
              color: '#fff', textAlign: 'center', fontSize: 14,
            }}>{errorMsg}</div>
          )}

          {[['t','l'],['t','r'],['b','l'],['b','r']].map(([v, h], i) => (
            <div key={i} style={{
              position: 'absolute',
              ...(v === 't' ? { top: 100 } : { bottom: 180 }),
              ...(h === 'l' ? { left: 40 } : { right: 40 }),
              width: 32, height: 32,
              borderTop: v === 't' ? '3px solid #fff' : 'none',
              borderBottom: v === 'b' ? '3px solid #fff' : 'none',
              borderLeft: h === 'l' ? '3px solid #fff' : 'none',
              borderRight: h === 'r' ? '3px solid #fff' : 'none',
              borderRadius: 4,
            }}/>
          ))}

          <div style={{ position: 'absolute', top: 12, left: 12, right: 12, display: 'flex', justifyContent: 'space-between' }}>
            <IconBtn icon="chevronLeft" onClick={() => { stopStream(); onBack?.(); }} tone="soft" />
            <div style={{ padding: '8px 14px', background: 'rgba(0,0,0,0.5)', borderRadius: 20, color: '#fff', fontSize: 12, fontWeight: 600 }}>
              Encuadra el ticket
            </div>
            <IconBtn icon="bolt" tone="soft" />
          </div>
        </div>

        {/* Sin capture — así el SO ofrece galería + cámara como opciones */}
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPickFile} />
        <div style={{ padding: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 40 }}>
          <button onClick={() => fileRef.current?.click()} style={{ width: 44, height: 44, borderRadius: 22, border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', fontSize: 20 }}>📁</button>
          <button onClick={onShutter} style={{
            width: 76, height: 76, borderRadius: 38, border: '4px solid #fff',
            background: 'transparent', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ width: 58, height: 58, borderRadius: 29, background: '#fff' }}/>
          </button>
          <button style={{ width: 44, height: 44, borderRadius: 22, border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer' }}>
            <LFIcon name="settings" size={20} color="#fff" />
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'scanning') {
    return (
      <div style={{ height: '100%', background: pal.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
        <div style={{ width: 80, height: 80, borderRadius: 40, background: pal.primarySoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <LFIcon name="sparkle" size={36} color={pal.primary} />
        </div>
        <div style={{ fontFamily: fonts.display, fontSize: 22, fontWeight: 700, color: pal.ink }}>Leyendo tu ticket…</div>
        <div style={{ fontSize: 13, color: pal.inkSoft, textAlign: 'center', padding: '0 40px' }}>
          Identificando alimentos y categorías con IA. Unos segundos.
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: pal.bg }}>
      <Header big title={`¡${detected.length} items detectados!`} subtitle="Revisa y ajusta antes de añadir"
        left={<IconBtn icon="chevronLeft" onClick={() => setPhase('camera')} />} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
        {(meta.store || meta.total) && (
          <div style={{
            padding: 12, background: pal.primarySoft, borderRadius: 12,
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
          }}>
            <span style={{ fontSize: 22 }}>🎉</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: pal.primary }}>
                {meta.store || 'Supermercado'}{meta.total ? ` · ${Number(meta.total).toFixed(2)} €` : ''}
              </div>
              {meta.savedOnDiscounts != null && (
                <div style={{ fontSize: 11, color: pal.primary, opacity: 0.8 }}>
                  Ahorraste {Number(meta.savedOnDiscounts).toFixed(2)} € con ofertas
                </div>
              )}
            </div>
          </div>
        )}
        {detected.map((d, i) => (
          <ScanItemRow key={i} item={d} pal={pal} fonts={fonts}
            onChange={(patch) => {
              const next = [...detected]; next[i] = { ...d, ...patch }; setDetected(next);
            }}
            onRemove={() => {
              const next = detected.filter((_, idx) => idx !== i); setDetected(next);
            }} />
        ))}
        {detected.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: pal.inkSoft }}>
            No detecté items. Prueba con otra foto.
          </div>
        )}
      </div>
      <div style={{ padding: 20 }}>
        <Button tone="green" size="lg" fullWidth onClick={commit} iconRight="check" disabled={!detected.length}>
          Añadir {detected.length} items
        </Button>
      </div>
    </div>
  );
}

// ─── Editor por línea del escaneo ────────────────────────────────────
const ScanItemRow = ({ item, pal, fonts, onChange, onRemove }) => {
  const [open, setOpen] = React.useState(false);
  const cat = LF_CATEGORIES.find((c) => c.id === item.cat || c.id === item.category) || LF_CATEGORIES[0];
  const locLabel = { fridge: 'Nevera', freezer: 'Congelador', pantry: 'Despensa' }[item.loc] || 'Despensa';
  return (
    <div style={{
      marginBottom: 8, background: pal.surface, borderRadius: 12,
      border: `0.5px solid ${pal.line}`, overflow: 'hidden',
    }}>
      <div onClick={() => setOpen((x) => !x)} style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: 12, cursor: 'pointer',
      }}>
        <div style={{
          width: 42, height: 42, borderRadius: 21, background: cat.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0,
        }}>{item.emoji || '🛒'}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: pal.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
          <div style={{ fontSize: 11, color: pal.inkSoft, marginTop: 2 }}>
            {item.qty || 1} {item.unit || 'uds'}{item.price != null ? ` · ${Number(item.price).toFixed(2)} €` : ''} · {cat.label} · {locLabel}
          </div>
        </div>
        <span style={{ fontSize: 14, color: pal.inkFaint, transform: `rotate(${open ? 90 : 0}deg)`, transition: 'transform .15s' }}>›</span>
      </div>
      {open && (
        <div style={{ padding: '0 12px 12px', borderTop: `0.5px solid ${pal.line}` }}>
          <FieldRow label="Nombre">
            <input value={item.name} onChange={(e) => onChange({ name: e.target.value })} style={inputCss(pal)} />
          </FieldRow>
          <FieldRow label="Tipo de cantidad">
            <div style={{ display: 'flex', gap: 6 }}>
              <TypeBtn pal={pal} active={item.type !== 'continuous'} onClick={() => onChange({ type: 'discrete', shape: null, unit: 'uds', fill: null })}>
                Discreto (uds, latas…)
              </TypeBtn>
              <TypeBtn pal={pal} active={item.type === 'continuous'} onClick={() => onChange({ type: 'continuous', shape: item.shape || 'bottle', unit: item.unit && ['L','ml','kg','g'].includes(item.unit) ? item.unit : 'L', fill: 100 })}>
                Continuo (L, kg…)
              </TypeBtn>
            </div>
          </FieldRow>
          {item.type === 'continuous' && (
            <FieldRow label="Forma del envase">
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { id: 'bottle', label: '🍶 Botella' },
                  { id: 'jar', label: '🫙 Tarro' },
                  { id: 'sack', label: '🛍️ Saco' },
                ].map((s) => (
                  <TypeBtn key={s.id} pal={pal} active={item.shape === s.id} onClick={() => onChange({ shape: s.id })}>
                    {s.label}
                  </TypeBtn>
                ))}
              </div>
            </FieldRow>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <FieldRow label="Cantidad" style={{ flex: 1 }}>
              <input type="number" inputMode="decimal" value={item.qty || ''} onChange={(e) => onChange({ qty: Number(e.target.value) || 1 })} style={inputCss(pal)} />
            </FieldRow>
            <FieldRow label="Unidad" style={{ flex: 1 }}>
              <select value={item.unit || (item.type === 'continuous' ? 'L' : 'uds')} onChange={(e) => onChange({ unit: e.target.value })} style={inputCss(pal)}>
                {item.type === 'continuous'
                  ? ['L', 'ml', 'kg', 'g'].map((u) => <option key={u} value={u}>{u}</option>)
                  : ['uds', 'latas', 'paquetes'].map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </FieldRow>
            <FieldRow label="Precio" style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', background: pal.bg, border: `1px solid ${pal.line}`, borderRadius: 8, paddingRight: 8 }}>
                <input type="number" inputMode="decimal" value={item.price ?? ''} onChange={(e) => onChange({ price: e.target.value === '' ? null : Number(e.target.value) })} style={{ flex: 1, padding: 8, fontSize: 13, border: 'none', background: 'transparent', outline: 'none', textAlign: 'right' }} />
                <span style={{ fontSize: 13, color: pal.inkSoft, fontWeight: 600 }}>€</span>
              </div>
            </FieldRow>
          </div>
          <FieldRow label="Categoría">
            <select value={item.cat || item.category || cat.id} onChange={(e) => onChange({ cat: e.target.value, category: e.target.value })} style={inputCss(pal)}>
              {LF_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </FieldRow>
          <div style={{ display: 'flex', gap: 8 }}>
            <FieldRow label="Ubicación" style={{ flex: 1 }}>
              <select value={item.loc || 'pantry'} onChange={(e) => onChange({ loc: e.target.value })} style={inputCss(pal)}>
                <option value="fridge">Nevera</option>
                <option value="freezer">Congelador</option>
                <option value="pantry">Despensa</option>
              </select>
            </FieldRow>
            <FieldRow label="Caduca en (días)" style={{ flex: 1 }}>
              <input type="number" inputMode="numeric"
                value={item.expiresAt == null ? '' : Math.max(0, Math.ceil((item.expiresAt - Date.now()) / 86400000))}
                placeholder="— sin caducidad"
                onChange={(e) => onChange({
                  expiresAt: e.target.value === '' ? null : (Date.now() + Number(e.target.value) * 86400000),
                })}
                style={inputCss(pal)} />
            </FieldRow>
          </div>
          <button onClick={onRemove} style={{
            width: '100%', marginTop: 8, padding: 10,
            background: pal.dangerSoft, border: 'none', borderRadius: 10,
            color: pal.danger, fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>🗑 Quitar este item</button>
        </div>
      )}
    </div>
  );
};

const FieldRow = ({ label, children, style }) => (
  <div style={{ marginTop: 8, ...style }}>
    <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(0,0,0,0.5)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
    {children}
  </div>
);
const TypeBtn = ({ pal, active, onClick, children }) => (
  <button onClick={onClick} style={{
    flex: 1, padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
    background: active ? pal.ink : pal.bg,
    color: active ? pal.bg : pal.inkSoft,
    border: `0.5px solid ${active ? pal.ink : pal.line}`,
    fontSize: 11, fontWeight: 600,
  }}>{children}</button>
);
const inputCss = (pal) => ({
  width: '100%', padding: '8px 10px', fontSize: 13,
  background: pal.bg, border: `1px solid ${pal.line}`,
  borderRadius: 8, color: pal.ink, outline: 'none',
});
