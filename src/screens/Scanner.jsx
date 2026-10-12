import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLF, haptic } from '../components/ctx.js';
import { Header, IconBtn, Button, toast } from '../components/base.jsx';
import { scanReceipt, proxyConfigured } from '../api.js';
import { LF_CATEGORIES } from '../tokens/categories.js';
import LFIcon from '../icons/LFIcon.jsx';
import { create as resourceCreate } from '../api/resources.js';
import { localISODate } from '../util/date.js';
import { daysToTs, suggestedExpiresAt } from '../util/expires.js';
import { makeLine, linesTotal } from '../util/expenseLines.js';
import { locLabel, shapeLabel, unitLabel } from '../i18n/labels.js';

const SCAN_CATS = ['lacteo', 'verdura', 'fruta', 'carne', 'pescado', 'pasta', 'conserva', 'salsa', 'especia', 'bebida', 'snack', 'congelado'];
const normalizeCat = (c) => (SCAN_CATS.includes(c) ? c : 'conserva');

// La fecha la lee la IA de la foto y se equivoca de año más de lo que parece
// (un ticket de hoy llegó como 2020-06-26). Una fecha absurda manda el gasto a
// un mes donde nadie lo va a buscar: Gastos abre en "Este mes" y no aparece.
// Fuera de la ventana razonable se descarta y se usa hoy, avisando.
function normalizeScanDate(raw) {
  const today = localISODate();
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { date: today, corrected: false };
  const unAnoAtras = localISODate(new Date(Date.now() - 365 * 86400000));
  if (raw > today || raw < unAnoAtras) return { date: today, corrected: true };
  return { date: raw, corrected: false };
}

export default function Scanner({ onBack, onDone }) {
  const { pal, fonts, currentHouseholdMeta, t } = useLF();
  const hid = currentHouseholdMeta?.id;
  const [phase, setPhase] = useState('camera'); // camera | scanning | results | error
  const [stream, setStream] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [detected, setDetected] = useState([]);
  const [meta, setMeta] = useState({ store: null, total: null, savedOnDiscounts: null });
  const videoRef = useRef(null);
  const fileRef = useRef(null);

  // Líneas del ticket tal y como quedarán guardadas dentro del gasto.
  const lines = useMemo(() => detected.map((d) => makeLine({
    name: d.name,
    emoji: d.emoji,
    cat: normalizeCat(d.cat || d.category),
    qty: d.qty,
    unit: d.unit || (d.type === 'continuous' ? 'L' : 'uds'),
    price: d.price,
  })), [detected]);
  const linesSum = linesTotal(lines);
  // Si la IA no ha sabido leer el total del ticket, lo sumamos de los productos:
  // así la compra queda registrada igual y no se pierde el gasto.
  const totalIsEstimated = meta.total == null && linesSum > 0;
  const effectiveTotal = meta.total != null
    ? Number(meta.total)
    : (linesSum > 0 ? Math.round(linesSum * 100) / 100 : null);

  // Cuadre: si las líneas no suman el total del ticket, la IA se dejó productos
  // o leyó mal un precio. Sin este aviso la diferencia se cuela callando en la
  // categoría "Otros" del desglose y el gasto parece correcto.
  // Se tolera un margen porque muchos tickets llevan bolsas, redondeos o
  // descuentos globales que no son líneas de producto.
  const descuadre = (() => {
    if (meta.total == null || linesSum <= 0) return null;
    const total = Number(meta.total);
    if (!Number.isFinite(total) || total <= 0) return null;
    const diff = +(total - linesSum).toFixed(2);
    const margen = Math.max(1, total * 0.05);
    if (Math.abs(diff) <= margen) return null;
    return { diff: Math.abs(diff), faltan: diff > 0 };
  })();

  useEffect(() => {
    if (phase !== 'camera') return;
    let active = true;
    (async () => {
      try {
        // Sin pedir resolución, el navegador entrega su valor por defecto:
        // normalmente 640×480, con suerte 720p. Un ticket tiene 40-60 líneas, y
        // a esa resolución cada línea son unos pocos píxeles de alto: le
        // estábamos pidiendo a la IA que leyera una foto mala.
        // `ideal` nunca falla — si la cámara no llega, entrega lo mejor que
        // tenga. Con `exact` sí podría negarse a abrir.
        const s = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 2560 },
            height: { ideal: 1440 },
          },
          audio: false,
        });
        if (!active) { s.getTracks().forEach((t) => t.stop()); return; }
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => {});
        }
      } catch (e) {
        setErrorMsg(t('scanner.camera.noAccess'));
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
    // 0.92 en vez de 0.85: el texto es el peor caso para JPEG, porque los
    // artefactos de compresión se comen justo los bordes de las letras finas.
    // El archivo pesa más, pero sigue muy por debajo del techo del proxy.
    return canvas.toDataURL('image/jpeg', 0.92);
  };

  const handleScan = async (dataUrl) => {
    if (!proxyConfigured()) {
      toast(t('scanner.noProxy'), 'error');
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
          type, shape, unit, // i18n-ignore
          loc: ['fridge', 'freezer', 'pantry'].includes(it.loc) ? it.loc : 'pantry',
          // null válido para conservas, especias, etc.
          expiresAt: it.expiresInDays == null ? null : daysToTs(it.expiresInDays),
        };
      });
      setDetected(items);
      const fecha = normalizeScanDate(result.date);
      setMeta({
        store: result.store, total: result.total,
        savedOnDiscounts: result.savedOnDiscounts,
        date: fecha.date, dateCorrected: fecha.corrected,
      });
      setPhase('results');
    } catch (e) {
      toast(t('scanner.readFailed'), 'error');
      setPhase('camera');
    }
  };

  // Si la IA se dejó un producto, antes no había forma de meterlo desde aquí:
  // sólo se podía editar o borrar lo que ella hubiera visto, y arreglarlo
  // obligaba a ir luego a Gastos a mano.
  const addDetectedLine = () => setDetected((xs) => [...xs, {
    name: '', emoji: '🛒', category: 'conserva', cat: 'conserva',
    qty: 1, unit: 'uds', type: 'discrete', loc: 'pantry',
    price: null, expiresAt: null, _nuevo: true,
  }]);

  const onShutter = () => {
    haptic(15);
    const url = captureFromVideo();
    if (!url) { toast(t('scanner.camera.notReady')); return; }
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
    if (!hid) { toast(t('scanner.noHousehold'), 'error'); return; }
    let expenseId = null;
    // Si hay total, creamos primero el expense para poder vincular los items.
    // Las líneas se congelan DENTRO del gasto: a partir de aquí el registro de la
    // compra vive por su cuenta y consumir o borrar items ya no puede vaciarlo.
    if (effectiveTotal != null) {
      try {
        const exp = await resourceCreate('expenses', hid, {
          date: meta.date || localISODate(),
          amount: effectiveTotal,
          store: meta.store || t('scanner.defaultStore'),
          cat: 'super',
          savedOnDiscounts: meta.savedOnDiscounts != null ? Number(meta.savedOnDiscounts) : null,
          items: lines,
        });
        expenseId = exp?.id || null;
      } catch (e) { /* sin expense, igual añadimos items sueltos */ }
    }
    let added = 0;
    for (const d of detected) {
      const cat = normalizeCat(d.cat || d.category);
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
    toast(t(expenseId ? 'scanner.addedWithReceipt' : 'scanner.added', { n: added }));
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
              {t('scanner.camera.frame')}
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
        <div style={{ fontFamily: fonts.display, fontSize: 22, fontWeight: 700, color: pal.ink }}>{t('scanner.scanning.title')}</div>
        <div style={{ fontSize: 13, color: pal.inkSoft, textAlign: 'center', padding: '0 40px' }}>
          {t('scanner.scanning.sub')}
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: pal.bg }}>
      <Header big title={t('scanner.results.title', { n: detected.length })} subtitle={t('scanner.results.subtitle')}
        left={<IconBtn icon="chevronLeft" onClick={() => setPhase('camera')} />} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
        {(meta.store || effectiveTotal != null) && (
          <div style={{
            padding: 12, background: pal.primarySoft, borderRadius: 12,
            marginBottom: 14,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 22 }}>🎉</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: pal.primary }}>
                  {meta.store || t('scanner.defaultStore')}{effectiveTotal != null ? ` · ${effectiveTotal.toFixed(2)} €` : ''}
                </div>
                {totalIsEstimated && (
                  <div style={{ fontSize: 11, color: pal.primary, opacity: 0.8 }}>
                    {t('scanner.results.estimatedTotal')}
                  </div>
                )}
                {meta.savedOnDiscounts != null && (
                  <div style={{ fontSize: 11, color: pal.primary, opacity: 0.8 }}>
                    {t('scanner.results.saved', { amount: Number(meta.savedOnDiscounts).toFixed(2) })}
                  </div>
                )}
              </div>
            </div>
            {/* La fecha decide en qué mes aparece el gasto. Si no se puede ver
                ni corregir aquí, un año mal leído lo esconde para siempre. */}
            <div style={{
              marginTop: 10, paddingTop: 10, borderTop: `0.5px solid ${pal.primary}33`,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: pal.primary, flexShrink: 0 }}>
                {t('scanner.results.purchaseDate')}
              </span>
              <input
                type="date"
                value={meta.date || ''}
                max={localISODate()}
                onChange={(e) => setMeta((m) => ({ ...m, date: e.target.value, dateCorrected: false }))}
                style={{
                  flex: 1, padding: '7px 10px', fontSize: 13,
                  background: pal.bg, border: `1px solid ${pal.line}`,
                  borderRadius: 8, color: pal.ink, outline: 'none',
                }} />
            </div>
            {meta.dateCorrected && (
              <div style={{ fontSize: 11, color: pal.primary, opacity: 0.8, marginTop: 6 }}>
                {t('scanner.results.dateCorrected')}
              </div>
            )}
          </div>
        )}

        {descuadre && (
          <div style={{
            padding: 12, marginBottom: 14, borderRadius: 12,
            background: pal.dangerSoft, display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <div style={{ flex: 1, fontSize: 12, color: pal.danger, lineHeight: 1.45 }}>
              <strong>{t('scanner.mismatch.title', { diff: descuadre.diff.toFixed(2) })}</strong>{' '}
              {descuadre.faltan
                ? t('scanner.mismatch.less')
                : t('scanner.mismatch.more')}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
          <button onClick={addDetectedLine} style={{
            background: pal.primarySoft, color: pal.primary,
            border: 'none', borderRadius: 10, padding: '7px 14px',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>{t('scanner.results.addProduct')}</button>
        </div>
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
            {t('scanner.results.none')}
          </div>
        )}
      </div>
      <div style={{ padding: 20 }}>
        <Button tone="green" size="lg" fullWidth onClick={commit} iconRight="check" disabled={!detected.length}>
          {t('scanner.results.addN', { n: detected.length })}
        </Button>
      </div>
    </div>
  );
}

// ─── Editor por línea del escaneo ────────────────────────────────────
const ScanItemRow = ({ item, pal, fonts, onChange, onRemove }) => {
  const { t } = useLF();
  // Las líneas añadidas a mano abren desplegadas: no tienen nada que enseñar
  // plegadas y lo primero que hay que hacer es escribirles el nombre.
  const [open, setOpen] = React.useState(!!item._nuevo);
  const cat = LF_CATEGORIES.find((c) => c.id === item.cat || c.id === item.category) || LF_CATEGORIES[0];
  const locName = locLabel(['fridge', 'freezer', 'pantry'].includes(item.loc) ? item.loc : 'pantry');
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
            {item.qty || 1} {unitLabel(item.unit || 'uds')}{item.price != null ? ` · ${Number(item.price).toFixed(2)} €` : ''} · {cat.label} · {locName}
          </div>
        </div>
        <span style={{ fontSize: 14, color: pal.inkFaint, transform: `rotate(${open ? 90 : 0}deg)`, transition: 'transform .15s' }}>›</span>
      </div>
      {open && (
        <div style={{ padding: '0 12px 12px', borderTop: `0.5px solid ${pal.line}` }}>
          <FieldRow label={t('scanner.row.name')}>
            <input value={item.name} onChange={(e) => onChange({ name: e.target.value })} style={inputCss(pal)} />
          </FieldRow>
          <FieldRow label={t('scanner.row.qtyType')}>
            <div style={{ display: 'flex', gap: 6 }}>
              <TypeBtn pal={pal} active={item.type !== 'continuous'} onClick={() => onChange({ type: 'discrete', shape: null, unit: 'uds', fill: null })}>
                {t('scanner.row.discrete')}
              </TypeBtn>
              <TypeBtn pal={pal} active={item.type === 'continuous'} onClick={() => onChange({ type: 'continuous', shape: item.shape || 'bottle', unit: item.unit && ['L','ml','kg','g'].includes(item.unit) ? item.unit : 'L', fill: 100 })}>
                {t('scanner.row.continuous')}
              </TypeBtn>
            </div>
          </FieldRow>
          {item.type === 'continuous' && (
            <FieldRow label={t('scanner.row.shape')}>
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { id: 'bottle', emoji: '🍶' },
                  { id: 'jar', emoji: '🫙' },
                  { id: 'sack', emoji: '🛍️' },
                ].map((s) => (
                  <TypeBtn key={s.id} pal={pal} active={item.shape === s.id} onClick={() => onChange({ shape: s.id })}>
                    {s.emoji} {shapeLabel(s.id)}
                  </TypeBtn>
                ))}
              </div>
            </FieldRow>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <FieldRow label={t('scanner.row.qty')} style={{ flex: 1 }}>
              <input type="number" inputMode="decimal" value={item.qty || ''} onChange={(e) => onChange({ qty: Number(e.target.value) || 1 })} style={inputCss(pal)} />
            </FieldRow>
            <FieldRow label={t('scanner.row.unit')} style={{ flex: 1 }}>
              <select value={item.unit || (item.type === 'continuous' ? 'L' : 'uds')} onChange={(e) => onChange({ unit: e.target.value })} style={inputCss(pal)}>
                {item.type === 'continuous'
                  ? ['L', 'ml', 'kg', 'g'].map((u) => <option key={u} value={u}>{unitLabel(u)}</option>)
                  : ['uds', 'latas', 'paquetes'].map((u) => <option key={u} value={u}>{unitLabel(u)}</option>)}
              </select>
            </FieldRow>
            <FieldRow label={t('scanner.row.price')} style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', background: pal.bg, border: `1px solid ${pal.line}`, borderRadius: 8, paddingRight: 8 }}>
                <input type="number" inputMode="decimal" value={item.price ?? ''} onChange={(e) => onChange({ price: e.target.value === '' ? null : Number(e.target.value) })} style={{ flex: 1, padding: 8, fontSize: 13, border: 'none', background: 'transparent', outline: 'none', textAlign: 'right' }} />
                <span style={{ fontSize: 13, color: pal.inkSoft, fontWeight: 600 }}>€</span>
              </div>
            </FieldRow>
          </div>
          <FieldRow label={t('scanner.row.cat')}>
            <select value={item.cat || item.category || cat.id} onChange={(e) => onChange({ cat: e.target.value, category: e.target.value })} style={inputCss(pal)}>
              {LF_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </FieldRow>
          <div style={{ display: 'flex', gap: 8 }}>
            <FieldRow label={t('scanner.row.loc')} style={{ flex: 1 }}>
              <select value={item.loc || 'pantry'} onChange={(e) => onChange({ loc: e.target.value })} style={inputCss(pal)}>
                <option value="fridge">{locLabel('fridge')}</option>
                <option value="freezer">{locLabel('freezer')}</option>
                <option value="pantry">{locLabel('pantry')}</option>
              </select>
            </FieldRow>
            <FieldRow label={t('scanner.row.expiresIn')} style={{ flex: 1 }}>
              <input type="number" inputMode="numeric"
                value={item.expiresAt == null ? '' : Math.max(0, Math.ceil((item.expiresAt - Date.now()) / 86400000))}
                placeholder={t('scanner.row.noExpiry')}
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
          }}>{t('scanner.row.remove')}</button>
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
