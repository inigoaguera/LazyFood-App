import React, { useState } from 'react';
import { useLF } from '../components/ctx.js';
import { Screen, Header, IconBtn, Button, toast } from '../components/base.jsx';
import { redeemInvite, setCurrentHousehold, fetchMe } from '../api/session.js';

// Acepta tanto un código suelto como una URL completa con ?invite=
function extractToken(input) {
  const s = (input || '').trim();
  if (!s) return '';
  try {
    const u = new URL(s);
    return u.searchParams.get('invite') || '';
  } catch {
    return s;
  }
}

export default function JoinHousehold({ onJoined, onBack }) {
  const { pal, fonts } = useLF();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const join = async () => {
    const token = extractToken(code);
    if (!token) { toast('Código inválido', 'error'); return; }
    setBusy(true);
    try {
      const r = await redeemInvite(token);
      await setCurrentHousehold(r.householdId);
      await fetchMe();
      toast(r.alreadyMember ? 'Ya eras miembro' : `Te has unido a ${r.name}`);
      onJoined(r.householdId);
    } catch (e) {
      toast(e?.message || 'No se pudo unir', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header big title="Unirme a una casa"
        subtitle="Pega el código o el link que te pasaron"
        left={<IconBtn icon="chevronLeft" onClick={onBack} />} />

      <div style={{ padding: '0 20px' }}>
        <input autoFocus value={code} onChange={(e) => setCode(e.target.value)}
          placeholder="ABC12345  o  https://lazyfood.pages.dev/?invite=ABC12345"
          style={{
            width: '100%', padding: '14px 16px', fontSize: 14,
            background: pal.surface, border: `1px solid ${pal.line}`,
            borderRadius: 12, color: pal.ink, outline: 'none',
          }} />

        <div style={{
          marginTop: 14, padding: 12, fontSize: 12, color: pal.inkSoft,
          background: pal.primarySoft, borderRadius: 12, lineHeight: 1.5,
        }}>
          💡 Si abres directamente el link de invitación, te uno automáticamente.
          Sólo usa este formulario si no tienes el link a mano.
        </div>

        <div style={{ marginTop: 24 }}>
          <Button tone="green" size="lg" fullWidth onClick={join} disabled={!code.trim() || busy}>
            {busy ? 'Uniendo…' : 'Unirme'}
          </Button>
        </div>
      </div>
    </Screen>
  );
}
