import React, { useEffect, useState } from 'react';
import { useLF } from '../components/ctx.js';
import { Screen, Header, IconBtn, Button, Card } from '../components/base.jsx';
import { fetchMe, setCurrentHousehold, logout } from '../api/session.js';

export default function HouseholdPicker({ onPick, onCreate, onJoin, onLogout }) {
  const { pal, fonts, me: cachedMe } = useLF();
  // Pinta inmediatamente lo que tengamos cacheado, refresca en background.
  const [me, setMe] = useState(cachedMe || null);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    setRefreshing(true);
    fetchMe()
      .then((m) => { if (!cancelled) setMe(m); })
      .catch((e) => { if (!cancelled && !cachedMe) setErr(e?.message || 'Error'); })
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
      <Header big title="¿Qué casa abres?"
        subtitle={me?.email}
        right={<IconBtn icon="more" tone="soft" onClick={handleLogout} />} />

      <div style={{ padding: '0 20px' }}>
        {loading && <div style={{ padding: 40, textAlign: 'center', color: pal.inkSoft }}>Cargando…</div>}
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
                    {h.role === 'owner' ? 'Eres propietario' : 'Eres miembro'}
                  </div>
                </div>
                <span style={{ fontSize: 22, color: pal.inkFaint }}>›</span>
              </Card>
            ))}
          </div>
        )}

        {me && me.households.length === 0 && !loading && (
          <div style={{
            padding: 24, textAlign: 'center', color: pal.inkSoft,
            background: pal.surface, borderRadius: 16, border: `0.5px solid ${pal.line}`, marginBottom: 18,
          }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🏠</div>
            <div style={{ fontSize: 14, lineHeight: 1.5 }}>
              Aún no formas parte de ninguna casa.<br/>
              Crea la tuya o únete con un código.
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Button tone="green" size="lg" fullWidth icon="plus" onClick={onCreate}>
            Crear nueva casa
          </Button>
          <Button tone="soft" size="lg" fullWidth onClick={onJoin}>
            Unirme con código
          </Button>
        </div>
      </div>
    </Screen>
  );
}
