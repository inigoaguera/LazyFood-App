import React, { useEffect, useRef, useState } from 'react';
import { useLF } from '../components/ctx.js';
import { Button, toast } from '../components/base.jsx';
import { requestMagicLink, verifyOtpCode } from '../api/session.js';
import { diagnose } from '../util/jwt.js';
import { isDebugActive } from '../util/debug.js';
import { LANGS, tNodes, errMsg } from '../i18n/index.js';
import { changeLang } from '../i18n/switch.js';

export default function Login({ pendingInvite }) {
  const { pal, fonts, lang, t } = useLF();
  const [email, setEmail] = useState('');
  const [phase, setPhase] = useState('form'); // form | sending | sent | error
  const [errorMsg, setErrorMsg] = useState('');
  const isDebug = isDebugActive();
  const [diag, setDiag] = useState(null);
  useEffect(() => {
    if (!isDebug) return;
    diagnose().then(setDiag).catch((e) => setDiag({ error: e?.message }));
  }, [isDebug]);

  // Gesto secreto: 7 toques en el aguacate activan modo debug. Útil cuando
  // estás en el PWA standalone y no puedes meter ?debug=1 en la URL.
  const tapsRef = useRef(0);
  const tapTimer = useRef(null);
  const onAvocadoTap = () => {
    tapsRef.current += 1;
    clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => { tapsRef.current = 0; }, 1500);
    if (tapsRef.current >= 7) {
      tapsRef.current = 0;
      try { window.localStorage.setItem('lf_debug', '1'); } catch {}
      toast('🛠 Modo debug activado'); // i18n-ignore
      setTimeout(() => window.location.reload(), 400);
    } else if (tapsRef.current >= 3) {
      toast(`${7 - tapsRef.current} más para debug`); // i18n-ignore
    }
  };

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const send = async () => {
    if (!valid) return;
    setPhase('sending');
    setErrorMsg('');
    try {
      await requestMagicLink(email.trim().toLowerCase(), lang);
      setPhase('sent');
    } catch (e) {
      setErrorMsg(errMsg(e, 'auth.login.sendFailed'));
      setPhase('error');
    }
  };

  // Verificación con código OTP de 6 dígitos
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const submitCode = async () => {
    if (code.length !== 6) return;
    setVerifying(true);
    setErrorMsg('');
    try {
      const res = await verifyOtpCode(email, code);
      if (res?.jwt) {
        // verifyOtpCode ya guardó el JWT y me; reload entra a la app
        window.location.reload();
      }
    } catch (e) {
      setErrorMsg(errMsg(e, 'auth.login.badCode'));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: pal.bg, padding: '40px 28px',
    }}>
      {/* Idioma antes de entrar: se guarda en este móvil y pasa a la cuenta al iniciar sesión. */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: -20 }}>
        {Object.keys(LANGS).map((k) => (
          <button key={k} onClick={() => { if (k !== lang) changeLang(k).catch(() => {}); }} style={{
            padding: '5px 10px', borderRadius: 12, cursor: 'pointer',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
            background: lang === k ? pal.ink : 'transparent',
            color: lang === k ? pal.bg : pal.inkSoft,
            border: `0.5px solid ${lang === k ? pal.ink : pal.line}`,
          }}>{k.toUpperCase()}</button>
        ))}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div onClick={onAvocadoTap} style={{
          fontSize: 64, textAlign: 'center', marginBottom: 16,
          cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none',
        }}>🥑</div>
        <h1 style={{
          fontFamily: fonts.display, fontSize: 32, fontWeight: 700,
          color: pal.ink, margin: 0, textAlign: 'center', letterSpacing: '-0.025em',
        }}>
          {phase === 'sent' ? t('auth.login.titleSent') : t('auth.login.title')}
        </h1>
        <p style={{
          color: pal.inkSoft, fontSize: 15, lineHeight: 1.5,
          textAlign: 'center', marginTop: 12,
        }}>
          {phase === 'sent'
            ? tNodes('auth.login.sentTo', { email: <strong>{email}</strong> })
            : pendingInvite
              ? t('auth.login.inviteHint')
              : t('auth.login.hint')}
        </p>

        {phase !== 'sent' && (
          <div style={{ marginTop: 32 }}>
            <input
              autoFocus value={email} type="email" autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
              placeholder={t('auth.login.emailPlaceholder')}
              style={{
                width: '100%', padding: '14px 18px', fontSize: 16,
                background: pal.surface, border: `1px solid ${pal.line}`,
                borderRadius: 14, color: pal.ink, outline: 'none',
              }}
            />
            {errorMsg && (
              <div style={{ marginTop: 12, padding: 10, background: pal.dangerSoft, color: pal.danger, borderRadius: 10, fontSize: 13 }}>
                {errorMsg}
              </div>
            )}
            <div style={{ marginTop: 18 }}>
              <Button tone="green" size="lg" fullWidth
                onClick={send} disabled={!valid || phase === 'sending'}>
                {phase === 'sending' ? t('auth.login.sending') : t('auth.login.send')}
              </Button>
            </div>
          </div>
        )}

        {phase === 'sent' && (
          <div style={{ marginTop: 32 }}>
            <input
              autoFocus value={code}
              type="text" inputMode="numeric" autoComplete="one-time-code"
              maxLength={6}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => { if (e.key === 'Enter') submitCode(); }}
              placeholder="123456"
              style={{
                width: '100%', padding: '16px 18px', fontSize: 26,
                fontFamily: 'ui-monospace, monospace',
                fontWeight: 700, letterSpacing: '0.3em',
                textAlign: 'center',
                background: pal.surface, border: `1px solid ${pal.line}`,
                borderRadius: 14, color: pal.ink, outline: 'none',
              }}
            />
            {errorMsg && (
              <div style={{ marginTop: 12, padding: 10, background: pal.dangerSoft, color: pal.danger, borderRadius: 10, fontSize: 13 }}>
                {errorMsg}
              </div>
            )}
            <div style={{ marginTop: 14 }}>
              <Button tone="green" size="lg" fullWidth
                onClick={submitCode} disabled={code.length !== 6 || verifying}>
                {verifying ? t('auth.login.verifying') : t('auth.login.submitCode')}
              </Button>
            </div>
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <button onClick={() => { setPhase('form'); setCode(''); setErrorMsg(''); }}
                style={{ background: 'transparent', border: 'none', color: pal.primary, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {t('auth.login.retry')}
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', fontSize: 11, color: pal.inkFaint, marginTop: 20 }}>
        {t('auth.login.footer')}
      </div>

      {isDebug && diag && (
        <div style={{
          marginTop: 20, padding: 14, background: pal.surface,
          border: `1px solid ${pal.lineStrong}`, borderRadius: 12,
          fontFamily: 'ui-monospace,monospace', fontSize: 11, color: pal.ink,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 6, fontFamily: 'inherit' }}>🛠 Diagnóstico storage</div>{/* i18n-ignore */}
          <pre style={{
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            background: pal.bg, padding: 10, borderRadius: 8, margin: 0, fontSize: 10,
          }}>{JSON.stringify(diag, null, 2)}</pre>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={() => diagnose().then(setDiag)} style={{
              flex: 1, padding: 8, background: pal.bg,
              border: `0.5px solid ${pal.line}`, borderRadius: 8,
              fontSize: 11, fontWeight: 600, color: pal.ink, cursor: 'pointer',
            }}>Refrescar</button>{/* i18n-ignore */}
            <button onClick={() => {
              try { navigator.clipboard.writeText(JSON.stringify(diag, null, 2)); }
              catch {}
            }} style={{
              flex: 1, padding: 8, background: pal.bg,
              border: `0.5px solid ${pal.line}`, borderRadius: 8,
              fontSize: 11, fontWeight: 600, color: pal.ink, cursor: 'pointer',
            }}>Copiar</button>{/* i18n-ignore */}
          </div>
        </div>
      )}
    </div>
  );
}
