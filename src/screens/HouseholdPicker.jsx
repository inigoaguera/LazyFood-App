import React, { useEffect, useState } from 'react';
import { useLF } from '../components/ctx.js';
import { Screen, Header, IconBtn, Button, Card } from '../components/base.jsx';
import { fetchMe, setCurrentHousehold, logout } from '../api/session.js';
import { errMsg } from '../i18n/index.js';

export default function HouseholdPicker({ onPick, onCreate, onJoin, onLogout }) {
  const { pal, fonts, me: cachedMe, t } = useLF();
  // Pinta inmediatamente lo que tengamos cacheado, refresca en background.
  const [me, setMe] = useState(cachedMe || null);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    setRefreshing(true);
    fetchMe()
      .then((m) => { if (!cancelled) setMe(m); })
      .catch((e) => { if (!cancelled && !cachedMe) setErr(errMsg(e)); })
      .finally(() => { if (!cancelled) setRefreshing(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loading = !me && !err;

  const pick = async (h) => {
    await setCurrentHousehold(h.id);
    onPick(h.id);
  };

  const handleLogout = async () => {
    await logout();
    onLogout?.();
  };

  return (
    <Screen>
      <Header big title={t('household.picker.title')}
        subtitle={me?.email}
        right={<IconBtn icon="more" tone="soft" onClick={handleLogout} />} />

      <div style={{ padding: '0 20px' }}>
        {loading && <div style={{ padding: 40, textAlign: 'center', color: pal.inkSoft }}>{t('common.loading')}</div>}
        {err && <div style={{ padding: 14, background: pal.dangerSoft, color: pal.danger, borderRadius: 12 }}>{err}</div>}

        {me?.households?.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
            {me.households.map((h) => (
              <Card key={h.id} onClick={() => pick(h)} style={{
                padding: 16, display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 24, flexShrink: 0,
                  background: h.color || pal.primary,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontFamily: fonts.display, fontSize: 22, fontWeight: 800,
                }}>{(h.name || '?').charAt(0).toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: fonts.display, fontSize: 17, fontWeight: 700, color: pal.ink }}>{h.name}</div>
                  <div style={{ fontSize: 11, color: pal.inkSoft, marginTop: 2 }}>
                    {h.role === 'owner' ? t('household.picker.youAreOwner') : t('household.picker.youAreMember')}
                  </div>
                </div>
                <span style={{ fontSize: 22, color: pal.inkFaint }}>›</span>
              </Card>
            ))}
          </div>
        )}

        {me?.households?.length === 0 && !loading && (
          <div style={{
            padding: 24, textAlign: 'center', color: pal.inkSoft,
            background: pal.surface, borderRadius: 16, border: `0.5px solid ${pal.line}`, marginBottom: 18,
          }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🏠</div>
            <div style={{ fontSize: 14, lineHeight: 1.5 }}>
              {t('household.picker.emptyLine1')}<br/>
              {t('household.picker.emptyLine2')}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Button tone="green" size="lg" fullWidth icon="plus" onClick={onCreate}>
            {t('household.picker.create')}
          </Button>
          <Button tone="soft" size="lg" fullWidth onClick={onJoin}>
            {t('household.picker.join')}
          </Button>
        </div>
      </div>
    </Screen>
  );
}
