import React, { useEffect, useRef, useState } from 'react';
import { useLF } from '../components/ctx.js';
import { Button } from '../components/base.jsx';
import { verifyMagicLink, redeemInvite } from '../api/session.js';
import { errMsg } from '../i18n/index.js';

export default function Verify({ token, pendingInvite, onSuccess, onFailure }) {
  const { pal, fonts, t } = useLF();
  const [phase, setPhase] = useState('verifying'); // verifying | invite | done | error
  const [errorMsg, setErrorMsg] = useState('');
  const [joinedName, setJoinedName] = useState(null);

  // Refs estables para callbacks y guardado del invite — evitan re-runs.
  const onSuccessRef = useRef(onSuccess);
  const pendingInviteRef = useRef(pendingInvite);
  useEffect(() => { onSuccessRef.current = onSuccess; }, [onSuccess]);
  useEffect(() => { pendingInviteRef.current = pendingInvite; }, [pendingInvite]);

  // Garantía: el verify se hace exactamente una vez por instancia del componente.
  const didRunRef = useRef(false);
  useEffect(() => {
    if (didRunRef.current) return;
    didRunRef.current = true;

    (async () => {
      try {
        await verifyMagicLink(token);
        const invite = pendingInviteRef.current;
        if (invite) {
          setPhase('invite');
          try {
            const r = await redeemInvite(invite);
            setJoinedName(r?.name || t('auth.verify.theHouse'));
            setPhase('done');
            setTimeout(() => onSuccessRef.current?.(r?.householdId), 1200);
          } catch (e) {
            setErrorMsg(t('auth.verify.inviteInvalid', { error: errMsg(e) }));
            setPhase('done');
            setTimeout(() => onSuccessRef.current?.(null), 1500);
          }
        } else {
          setPhase('done');
          setTimeout(() => onSuccessRef.current?.(null), 600);
        }
      } catch (e) {
        setErrorMsg(errMsg(e, 'auth.verify.verifyFailed'));
        setPhase('error');
      }
    })();
  }, [token]);

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: pal.bg, padding: 40, alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ fontSize: 64 }}>{phase === 'error' ? '😕' : '🥑'}</div>
      <h1 style={{
        fontFamily: fonts.display, fontSize: 22, fontWeight: 700,
        color: pal.ink, margin: '14px 0 8px', textAlign: 'center',
      }}>
        {phase === 'verifying' && t('auth.verify.verifying')}
        {phase === 'invite' && t('auth.verify.joining')}
        {phase === 'done' && (joinedName ? t('auth.verify.welcome', { name: joinedName }) : t('auth.verify.done'))}
        {phase === 'error' && t('auth.verify.failed')}
      </h1>
      {errorMsg && (
        <p style={{ color: pal.inkSoft, fontSize: 14, textAlign: 'center', maxWidth: 320 }}>{errorMsg}</p>
      )}
      {phase === 'error' && (
        <div style={{ marginTop: 24 }}>
          <Button tone="green" size="md" onClick={onFailure}>{t('auth.verify.restart')}</Button>
        </div>
      )}
    </div>
  );
}
