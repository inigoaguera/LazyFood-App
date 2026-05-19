import React, { useRef, useState } from 'react';
import { useLF, haptic } from './ctx.js';
import { LF_SHADOWS } from '../tokens/palettes.js';
import LFIcon from '../icons/LFIcon.jsx';

// ─── Screen ─────────────────────────────────────────────────────────────
export const Screen = ({ children, scrollable = true, padBottom = 100, style }) => (
  <div style={{
    flex: 1, overflowY: scrollable ? 'auto' : 'hidden',
    overflowX: 'hidden', paddingBottom: padBottom, ...style,
  }}>{children}</div>
);

// ─── Header ─────────────────────────────────────────────────────────────
export const Header = ({ title, subtitle, left, right, big }) => {
  const { pal, fonts } = useLF();
  return (
    <div style={{ padding: big ? '8px 20px 12px' : '6px 16px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 36 }}>
        <div style={{ minWidth: 36 }}>{left}</div>
        {!big && <div style={{ fontFamily: fonts.body, fontWeight: 600, fontSize: 16, color: pal.ink }}>{title}</div>}
        <div style={{ minWidth: 36, display: 'flex', justifyContent: 'flex-end', gap: 6 }}>{right}</div>
      </div>
      {big && (
        <div style={{ padding: '6px 4px 0' }}>
          <h1 style={{
            fontFamily: fonts.display, fontWeight: 700,
            fontSize: 34, lineHeight: 1.05, margin: 0,
            color: pal.ink, letterSpacing: '-0.02em',
          }}>{title}</h1>
          {subtitle && <div style={{ fontSize: 14, color: pal.inkSoft, marginTop: 4 }}>{subtitle}</div>}
        </div>
      )}
    </div>
  );
};

// ─── IconBtn ────────────────────────────────────────────────────────────
export const IconBtn = ({ icon, onClick, badge, tone = 'ghost', size = 36 }) => {
  const { pal } = useLF();
  const tones = {
    ghost: { bg: 'transparent', color: pal.ink },
    soft: { bg: pal.surface, color: pal.ink, shadow: LF_SHADOWS.sm },
    primary: { bg: pal.primary, color: '#fff' },
  };
  const t = tones[tone];
  return (
    <button onClick={(e) => { haptic(); onClick?.(e); }} style={{
      width: size, height: size, borderRadius: size / 2,
      background: t.bg, color: t.color, border: 'none', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', boxShadow: t.shadow || 'none', padding: 0,
    }}>
      <LFIcon name={icon} size={size <= 36 ? 20 : 22} />
      {badge && (
        <span style={{
          position: 'absolute', top: 2, right: 2, minWidth: 16, height: 16, padding: '0 4px',
          borderRadius: 8, background: pal.accent, color: '#fff',
          fontSize: 10, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{badge}</span>
      )}
    </button>
  );
};

// ─── Chip ───────────────────────────────────────────────────────────────
export const Chip = ({ label, active, onClick, icon, color, count }) => {
  const { pal } = useLF();
  return (
    <button onClick={(e) => { haptic(); onClick?.(e); }} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '8px 14px', height: 34, borderRadius: 17,
      background: active ? pal.ink : pal.surface,
      color: active ? pal.surface : pal.ink,
      border: `0.5px solid ${active ? pal.ink : pal.line}`,
      fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap',
      cursor: 'pointer', flexShrink: 0,
      boxShadow: active ? 'none' : LF_SHADOWS.sm,
    }}>
      {color && <span style={{ width: 10, height: 10, borderRadius: 5, background: color }}/>}
      {icon && <LFIcon name={icon} size={14} />}
      {label}
      {count != null && (
        <span style={{ fontSize: 11, opacity: 0.7, fontWeight: 500, marginLeft: 2, minWidth: 14, textAlign: 'right' }}>{count}</span>
      )}
    </button>
  );
};

// ─── Button ─────────────────────────────────────────────────────────────
export const Button = ({ children, onClick, tone = 'primary', size = 'md', icon, iconRight, fullWidth, style, disabled }) => {
  const { pal, fonts } = useLF();
  const sizes = {
    sm: { h: 36, px: 14, fs: 13, rad: 18 },
    md: { h: 48, px: 20, fs: 15, rad: 24 },
    lg: { h: 58, px: 24, fs: 17, rad: 29 },
    xl: { h: 66, px: 28, fs: 18, rad: 33 },
  };
  const tones = {
    primary: { bg: pal.ink, fg: pal.bg },
    accent: { bg: pal.accent, fg: pal.ink },
    green: { bg: pal.primary, fg: '#fff' },
    soft: { bg: pal.surface, fg: pal.ink, border: `0.5px solid ${pal.line}` },
    ghost: { bg: 'transparent', fg: pal.ink },
  };
  const s = sizes[size]; const t = tones[tone];
  return (
    <button disabled={disabled} onClick={(e) => { haptic(); onClick?.(e); }} style={{
      height: s.h, padding: `0 ${s.px}px`,
      width: fullWidth ? '100%' : undefined, borderRadius: s.rad,
      background: t.bg, color: t.fg, border: t.border || 'none',
      fontSize: s.fs, fontWeight: 600, fontFamily: fonts.body,
      cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.6 : 1,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      boxShadow: tone === 'primary' || tone === 'accent' || tone === 'green' ? LF_SHADOWS.md : LF_SHADOWS.sm,
      ...style,
    }}>
      {icon && <LFIcon name={icon} size={s.fs + 3} />}
      {children}
      {iconRight && <LFIcon name={iconRight} size={s.fs + 3} />}
    </button>
  );
};

// ─── BottomNav ──────────────────────────────────────────────────────────
export const BottomNav = ({ active, onNav, onScan }) => {
  const { pal } = useLF();
  const tabs = [
    { id: 'home',     label: 'Inicio',    icon: 'home' },
    { id: 'list',     label: 'Todo',      icon: 'list' },
    { id: 'recipes',  label: 'Recetas',   icon: 'chef', dot: true },
    { id: 'expenses', label: 'Gastos',    icon: 'chart' },
  ];
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      height: `calc(84px + env(safe-area-inset-bottom))`,
      paddingBottom: `calc(16px + env(safe-area-inset-bottom))`,
      background: `linear-gradient(to top, ${pal.bg} 70%, ${pal.bg}00)`,
      pointerEvents: 'none',
    }}>
      <div style={{
        position: 'absolute', bottom: `calc(16px + env(safe-area-inset-bottom))`, left: 16, right: 16,
        height: 64, background: pal.surface,
        borderRadius: 32, boxShadow: LF_SHADOWS.float,
        display: 'flex', alignItems: 'center', padding: '0 8px', pointerEvents: 'auto',
        border: `0.5px solid ${pal.line}`,
      }}>
        {tabs.slice(0, 2).map((t) => (
          <NavTab key={t.id} tab={t} active={active === t.id} onClick={() => { haptic(); onNav(t.id); }} />
        ))}
        <div style={{ flex: '0 0 64px', display: 'flex', justifyContent: 'center', position: 'relative' }}>
          <button onClick={() => { haptic(20); onScan(); }} style={{
            position: 'absolute', top: -24, width: 60, height: 60, borderRadius: 30,
            background: pal.primary, color: '#fff', border: `4px solid ${pal.surface}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', boxShadow: LF_SHADOWS.float,
          }}>
            <LFIcon name="scan" size={26} color="#fff" strokeWidth={2} />
          </button>
        </div>
        {tabs.slice(2).map((t) => (
          <NavTab key={t.id} tab={t} active={active === t.id} onClick={() => { haptic(); onNav(t.id); }} />
        ))}
      </div>
    </div>
  );
};

const NavTab = ({ tab, active, onClick }) => {
  const { pal } = useLF();
  return (
    <button onClick={onClick} style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 2, background: 'transparent', border: 'none',
      cursor: 'pointer', color: active ? pal.ink : pal.inkFaint,
      padding: '8px 0', position: 'relative',
    }}>
      <div style={{ position: 'relative' }}>
        <LFIcon name={tab.icon} size={22} strokeWidth={active ? 2 : 1.6} />
        {tab.dot && (
          <span style={{
            position: 'absolute', top: -2, right: -4, width: 6, height: 6,
            borderRadius: 3, background: pal.accent,
          }}/>
        )}
      </div>
      <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, letterSpacing: '0.01em' }}>{tab.label}</span>
    </button>
  );
};

// ─── Card ───────────────────────────────────────────────────────────────
export const Card = ({ children, onClick, style, pad = true }) => {
  const { pal, dens } = useLF();
  return (
    <div onClick={onClick} style={{
      background: pal.surface, borderRadius: dens.radius,
      border: `0.5px solid ${pal.line}`, boxShadow: LF_SHADOWS.sm,
      padding: pad ? dens.pad : 0,
      cursor: onClick ? 'pointer' : 'default', ...style,
    }}>{children}</div>
  );
};

// ─── SwipeRow ───────────────────────────────────────────────────────────
export const SwipeRow = ({ children, actions, height }) => {
  const { pal } = useLF();
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const currX = useRef(0);
  const max = actions.length * 72;

  const onStart = (clientX) => { startX.current = clientX; currX.current = dx; setDragging(true); };
  const onMove = (clientX) => {
    if (!dragging) return;
    const d = clientX - startX.current + currX.current;
    setDx(Math.max(-max, Math.min(0, d)));
  };
  const onEnd = () => { setDragging(false); setDx(dx < -max / 2 ? -max : 0); };

  return (
    <div style={{ position: 'relative', overflow: 'hidden', height, borderRadius: 14 }}>
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, display: 'flex' }}>
        {actions.map((a, i) => (
          <button key={i} onClick={() => { haptic(); a.onClick(); setDx(0); }} style={{
            width: 72, height: '100%', border: 'none',
            background: a.bg || pal.danger, color: a.fg || '#fff',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600,
          }}>
            <LFIcon name={a.icon} size={20} color={a.fg || '#fff'} />
            {a.label}
          </button>
        ))}
      </div>
      <div
        onMouseDown={(e) => onStart(e.clientX)}
        onMouseMove={(e) => onMove(e.clientX)}
        onMouseUp={onEnd}
        onMouseLeave={onEnd}
        onTouchStart={(e) => onStart(e.touches[0].clientX)}
        onTouchMove={(e) => onMove(e.touches[0].clientX)}
        onTouchEnd={onEnd}
        style={{
          transform: `translateX(${dx}px)`,
          transition: dragging ? 'none' : 'transform .22s cubic-bezier(.3,.7,.4,1)',
          height: '100%', background: pal.surface, touchAction: 'pan-y',
        }}>
        {children}
      </div>
    </div>
  );
};

export const Divider = () => {
  const { pal } = useLF();
  return <div style={{ height: 0.5, background: pal.line, margin: '4px 0' }}/>;
};

// ─── Toast (lightweight) ────────────────────────────────────────────────
// toast('hola')                                  → simple
// toast('error', 'error')                        → con tono error
// toast('Te falta...', 'info', { action: { label: 'A la compra', onClick: ... }, duration: 6000 })
let toastListeners = new Set();
export const toast = (message, kind = 'info', options = {}) => {
  toastListeners.forEach((fn) => fn({
    message, kind,
    action: options.action || null,
    duration: options.duration || (options.action ? 6000 : 2600),
    id: Math.random(),
  }));
};
export const ToastHost = () => {
  const { pal } = useLF();
  const [items, setItems] = useState([]);
  React.useEffect(() => {
    const listener = (t) => {
      setItems((xs) => [...xs, t]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== t.id)), t.duration);
    };
    toastListeners.add(listener);
    return () => toastListeners.delete(listener);
  }, []);
  if (!items.length) return null;
  return (
    <div style={{
      position: 'absolute', bottom: 110, left: 0, right: 0,
      display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center',
      pointerEvents: 'none', zIndex: 60,
    }}>
      {items.map((it) => (
        <div key={it.id} style={{
          padding: it.action ? '10px 10px 10px 16px' : '10px 16px',
          borderRadius: 16,
          background: it.kind === 'error' ? pal.danger : pal.ink,
          color: '#fff', fontSize: 13, fontWeight: 600,
          boxShadow: LF_SHADOWS.lg, animation: 'fadeIn .2s',
          maxWidth: '92%', textAlign: 'center',
          display: 'inline-flex', alignItems: 'center', gap: 10,
          pointerEvents: 'auto',
        }}>
          <span>{it.message}</span>
          {it.action && (
            <button onClick={() => {
              it.action.onClick?.();
              setItems((xs) => xs.filter((x) => x.id !== it.id));
            }} style={{
              padding: '6px 12px', borderRadius: 12,
              background: 'rgba(255,255,255,0.15)', color: '#fff',
              border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              flexShrink: 0,
            }}>{it.action.label}</button>
          )}
        </div>
      ))}
    </div>
  );
};
