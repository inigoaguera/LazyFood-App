import React, { useEffect, useRef, useState } from 'react';
import { useLF } from '../components/ctx.js';
import { Button } from '../components/base.jsx';
import { verifyMagicLink, redeemInvite } from '../api/session.js';

export default function Verify({ token, pendingInvite, onSuccess, onFailure }) {
  const { pal, fonts } = useLF();
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
            setJoinedName(r?.name || 'la casa');
            setPhase('done');
            setTimeout(() => onSuccessRef.current?.(r?.householdId), 1200);
          } catch (e) {
            setErrorMsg(`Te has logueado, pero la invitación no es válida: ${e.message}`);
            setPhase('done');
            setTimeout(() => onSuccessRef.current?.(null), 1500);
          }
        } else {
          setPhase('done');
          setTimeout(() => onSuccessRef.current?.(null), 600);
        }
      } catch (e) {
        setErrorMsg(e?.message || 'No he podido verificar el link');
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
        {phase === 'verifying' && 'Verificando…'}
        {phase === 'invite' && 'Uniéndote a la casa…'}
        {phase === 'done' && (joinedName ? `¡Bienvenida a ${joinedName}!` : '¡Listo!')}
        {phase === 'error' && 'Ha fallado'}
      </h1>
      {errorMsg && (
        <p style={{ color: pal.inkSoft, fontSize: 14, textAlign: 'center', maxWidth: 320 }}>{errorMsg}</p>
      )}
      {phase === 'error' && (
        <div style={{ marginTop: 24 }}>
          <Button tone="green" size="md" onClick={onFailure}>Volver a empezar</Button>
        </div>
      )}
    </div>
  );
}
