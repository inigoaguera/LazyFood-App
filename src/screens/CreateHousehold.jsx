import React, { useState } from 'react';
import { useLF } from '../components/ctx.js';
import { Screen, Header, IconBtn, Button, toast } from '../components/base.jsx';
import { createHousehold, setCurrentHousehold, fetchMe } from '../api/session.js';
import { errMsg } from '../i18n/index.js';

const COLORS = ['#4A7C3A', '#0F9D6E', '#C25A3C', '#7FB0C4', '#E8A838', '#5DB8C4', '#B85AAB'];

export default function CreateHousehold({ onCreated, onBack }) {
  const { pal, fonts, t } = useLF();
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const h = await createHousehold(name.trim(), color);
      await setCurrentHousehold(h.id);
      await fetchMe();
      toast(t('household.create.created', { name: h.name }));
      onCreated(h.id);
    } catch (e) {
      toast(errMsg(e, 'household.create.createFailed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header big title={t('household.create.title')}
        subtitle={t('household.create.subtitle')}
        left={<IconBtn icon="chevronLeft" onClick={onBack} />} />

      <div style={{ padding: '0 20px' }}>
        <div style={{ marginBottom: 18 }}>
          <Label>{t('household.create.name')}</Label>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
            placeholder={t('household.create.namePlaceholder')}
            style={{
              width: '100%', padding: '14px 16px', fontSize: 15,
              background: pal.surface, border: `1px solid ${pal.line}`,
              borderRadius: 12, color: pal.ink, outline: 'none', marginTop: 8,
            }} />
        </div>

        <div style={{ marginBottom: 24 }}>
          <Label>{t('household.create.color')}</Label>
          <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
            {COLORS.map((c) => (
              <button key={c} onClick={() => setColor(c)} style={{
                width: 44, height: 44, borderRadius: 22,
                background: c, cursor: 'pointer',
                border: color === c ? `3px solid ${pal.ink}` : `2px solid ${pal.line}`,
                padding: 0,
              }}/>
            ))}
          </div>
        </div>

        <div style={{
          padding: 14, background: pal.surface, borderRadius: 14,
          border: `0.5px solid ${pal.line}`, display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 28, background: color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontFamily: fonts.display, fontSize: 24, fontWeight: 800,
          }}>{(name || '?').charAt(0).toUpperCase()}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: pal.inkFaint, fontWeight: 600 }}>{t('household.create.preview')}</div>
            <div style={{ fontFamily: fonts.display, fontSize: 18, fontWeight: 700, color: pal.ink }}>
              {name || t('household.create.yourHouse')}
            </div>
          </div>
        </div>

        <Button tone="green" size="lg" fullWidth disabled={!name.trim() || busy} onClick={create}>
          {busy ? t('household.create.creating') : t('household.create.submit')}
        </Button>
      </div>
    </Screen>
  );
}

const Label = ({ children }) => {
  const { pal } = useLF();
  return <div style={{ fontSize: 12, fontWeight: 700, color: pal.inkSoft, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{children}</div>;
};
