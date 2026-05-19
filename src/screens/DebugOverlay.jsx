import React, { useState, useEffect } from 'react';
import { useLF } from '../components/ctx.js';
import { diagnose } from '../util/jwt.js';
import { disableDebug } from '../util/debug.js';

// Panel flotante de diagnóstico. Sólo aparece cuando la URL contiene ?debug=1.
// Sirve para ver el estado de IndexedDB + localStorage en cualquier pantalla
// (incluso después de loguearte) y compararlo si la PWA pierde la sesión.
export default function DebugOverlay() {
  const { pal } = useLF();
  const [open, setOpen] = useState(false);
  const [diag, setDiag] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    try { setDiag(await diagnose()); }
    catch (e) { setDiag({ error: e?.message }); }
    finally { setRefreshing(false); }
  };

  // Auto-refresca cada vez que el panel se abre (no sólo al montar el componente).
  useEffect(() => { if (open) refresh(); }, [open]);

  const copyJson = () => {
    try { navigator.clipboard.writeText(JSON.stringify(diag, null, 2)); }
    catch {}
  };

  // Botón flotante minimizado
  if (!open) {
    return (
      <button onClick={() => { setOpen(true); refresh(); }} style={{
        position: 'fixed', top: 80, right: 14, zIndex: 200,
        width: 44, height: 44, borderRadius: 22,
        background: pal.ink, color: pal.bg, border: `2px solid ${pal.bg}`,
        fontSize: 18, fontWeight: 700, cursor: 'pointer',
        boxShadow: '0 6px 16px rgba(0,0,0,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }} title="Ver diagnóstico">🔍</button>
    );
  }

  // Panel desplegado
  return (
    <div style={{
      position: 'fixed', inset: 14, zIndex: 200,
      background: pal.bg, border: `2px solid ${pal.ink}`, borderRadius: 14,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
    }}>
      <div style={{
        padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: pal.ink, color: pal.bg,
      }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>🔍 Diagnóstico</span>
        <button onClick={() => setOpen(false)} style={{
          background: 'transparent', border: 'none', color: pal.bg,
          fontSize: 18, fontWeight: 700, cursor: 'pointer', padding: 0, width: 28, height: 28,
        }}>×</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 12, fontFamily: 'ui-monospace,monospace', fontSize: 11 }}>
        <pre style={{
          margin: 0, padding: 10, background: pal.surface, color: pal.ink,
          borderRadius: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 10,
        }}>{diag ? JSON.stringify(diag, null, 2) : 'Cargando…'}</pre>
      </div>
      <div style={{
        padding: 10, display: 'flex', flexDirection: 'column', gap: 8,
        borderTop: `0.5px solid ${pal.line}`, background: pal.surface,
      }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={refresh} disabled={refreshing} style={{
            flex: 1, padding: 10, background: pal.bg,
            border: `0.5px solid ${pal.line}`, borderRadius: 10,
            fontSize: 12, fontWeight: 600, color: pal.ink, cursor: 'pointer',
          }}>{refreshing ? '…' : 'Refrescar'}</button>
          <button onClick={copyJson} style={{
            flex: 2, padding: 10, background: pal.primary,
            border: 'none', borderRadius: 10,
            fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer',
          }}>📋 Copiar JSON</button>
        </div>
        <button onClick={() => { disableDebug(); window.location.reload(); }} style={{
          width: '100%', padding: 8, background: 'transparent',
          border: 'none', color: pal.danger,
          fontSize: 11, fontWeight: 600, cursor: 'pointer',
        }}>Salir de modo debug</button>
      </div>
    </div>
  );
}
