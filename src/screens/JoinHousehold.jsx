import React, { useState } from 'react';
import { useLF } from '../components/ctx.js';
import { Screen, Header, IconBtn, Button, toast } from '../components/base.jsx';
import { redeemInvite, setCurrentHousehold, fetchMe } from '../api/session.js';
import { errMsg } from '../i18n/index.js';

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
  const { pal, fonts, t } = useLF();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const join = async () => {
    const token = extractToken(code);
    if (!token) { toast(t('household.join.invalidCode'), 'error'); return; }
    setBusy(true);
    try {
      const r = await redeemInvite(token);
      await setCurrentHousehold(r.householdId);
      await fetchMe();
      toast(r.alreadyMember ? t('household.join.alreadyMember') : t('household.join.joined', { name: r.name }));
      onJoined(r.householdId);
    } catch (e) {
      toast(errMsg(e, 'household.join.joinFailed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header big title={t('household.join.title')}
        subtitle={t('household.join.subtitle')}
        left={<IconBtn icon="chevronLeft" onClick={onBack} />} />

      <div style={{ padding: '0 20px' }}>
        <input autoFocus value={code} onChange={(e) => setCode(e.target.value)}
          placeholder={t('household.join.placeholder')}
          style={{
            width: '100%', padding: '14px 16px', fontSize: 14,
            background: pal.surface, border: `1px solid ${pal.line}`,
            borderRadius: 12, color: pal.ink, outline: 'none',
          }} />

        <div style={{
          marginTop: 14, padding: 12, fontSize: 12, color: pal.inkSoft,
          background: pal.primarySoft, borderRadius: 12, lineHeight: 1.5,
        }}>
          {t('household.join.tip')}
        </div>

        <div style={{ marginTop: 24 }}>
          <Button tone="green" size="lg" fullWidth onClick={join} disabled={!code.trim() || busy}>
            {busy ? t('household.join.joining') : t('household.join.submit')}
          </Button>
        </div>
      </div>
    </Screen>
  );
}
