import React from 'react';
import { t } from '../i18n/index.js';

// Red de seguridad de último recurso.
//
// Sin esto, CUALQUIER excepción durante el render desmonta el árbol entero y
// deja una pantalla en blanco sin explicación ni forma de salir. Fue lo que
// convirtió un `me.households` sin guarda en un muro (P0-3 de la auditoría).
//
// No usa el contexto de la app (paleta, fuentes) a propósito: tiene que poder
// pintarse aunque lo que haya fallado sea justamente el contexto.
const COLORS = { bg: '#F5F1E8', surface: '#FFFDF7', ink: '#2C3A24', inkSoft: '#6B7A5E', primary: '#4A7C3A', line: '#E3DED0' };

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, showDetail: false };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Queda en consola para poder verlo con eruda desde el móvil (?debug=1).
    console.error('[lazyfood] error no controlado en el render:', error, info?.componentStack);
  }

  render() {
    const { error, showDetail } = this.state;
    if (!error) return this.props.children;

    return (
      <div style={{
        position: 'fixed', inset: 0, background: COLORS.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        <div style={{
          width: '100%', maxWidth: 380, background: COLORS.surface,
          borderRadius: 20, border: `0.5px solid ${COLORS.line}`,
          padding: 24, textAlign: 'center',
        }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🥑</div>
          <div style={{ fontSize: 19, fontWeight: 700, color: COLORS.ink, marginBottom: 8 }}>
            {t('common.crash.title')}
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.5, color: COLORS.inkSoft, marginBottom: 20 }}>
            {t('common.crash.body')}
          </div>

          <button
            onClick={() => window.location.reload()}
            style={{
              width: '100%', padding: '13px 18px', border: 'none', borderRadius: 14,
              background: COLORS.primary, color: '#fff',
              fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}>
            {t('common.crash.reload')}
          </button>

          <button
            onClick={() => this.setState((s) => ({ showDetail: !s.showDetail }))}
            style={{
              marginTop: 10, background: 'transparent', border: 'none',
              color: COLORS.inkSoft, fontSize: 12, cursor: 'pointer', textDecoration: 'underline',
            }}>
            {showDetail ? t('common.crash.hideDetail') : t('common.crash.showDetail')}
          </button>

          {showDetail && (
            <pre style={{
              marginTop: 12, padding: 12, background: COLORS.bg,
              borderRadius: 10, textAlign: 'left',
              fontSize: 11, lineHeight: 1.4, color: COLORS.ink,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              maxHeight: 200, overflowY: 'auto',
            }}>
              {String(error?.stack || error?.message || error)}
            </pre>
          )}
        </div>
      </div>
    );
  }
}
