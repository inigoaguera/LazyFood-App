import React, { useEffect, useState } from 'react';
import { useLF } from '../components/ctx.js';
import { Screen, Header, Button, toast } from '../components/base.jsx';
import { LF_SHADOWS } from '../tokens/palettes.js';
import { getLegacyData, clearLegacy } from '../db.js';
import { bulkImport } from '../api/resources.js';
import { syncHousehold } from '../api/sync.js';
import { createHousehold, setCurrentHousehold, fetchMe } from '../api/session.js';

export default function ImportLocalData({ onDone, onSkip }) {
  const { pal, fonts } = useLF();
  const [legacy, setLegacy] = useState(null);
  const [busy, setBusy] = useState(false);
  const [householdName, setHouseholdName] = useState('Mi casa');

  useEffect(() => {
    (async () => {
      const data = await getLegacyData();
      setLegacy(data);
    })();
  }, []);

  const counts = legacy ? {
    items: legacy.items?.length || 0,
    recipes: legacy.recipes?.length || 0,
    shopping: legacy.shopping?.length || 0,
    menuPlan: legacy.menuPlan?.length || 0,
    recipeDetails: legacy.recipeDetails?.length || 0,
  } : null;
  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;

  const doImport = async () => {
    if (!householdName.trim()) return;
    setBusy(true);
    try {
      const h = await createHousehold(householdName.trim(), '#4A7C3A');
      await setCurrentHousehold(h.id);
      // Limpia menuPlan: id local lo deshecharemos, slot+recipeId valen
      const payload = {
        items: legacy.items || [],
        recipes: legacy.recipes || [],
        shopping: legacy.shopping || [],
        expenses: legacy.expenses || [],
        recipeDetails: (legacy.recipeDetails || []).map((r) => ({
          ...r,
          matchName: r.matchName || r.match_name,
        })),
        menuPlan: (legacy.menuPlan || []).map((m) => ({ slot: m.slot, recipeId: String(m.recipeId) })),
      };
      const res = await bulkImport(h.id, payload);
      await clearLegacy();
      await fetchMe();
      await syncHousehold(h.id, { full: true });
      toast(`¡Importados ${total} elementos a "${h.name}"!`);
      onDone(h.id);
    } catch (e) {
      toast(e?.message || 'No se pudo importar', 'error');
    } finally {
      setBusy(false);
    }
  };

  const skipImport = async () => {
    if (!confirm('¿Descartar los datos locales? No podrás recuperarlos.')) return;
    await clearLegacy();
    onSkip();
  };

  return (
    <Screen>
      <Header big title="Tienes datos sin subir"
        subtitle="Encontré comida, recetas y listas que tenías en este móvil de antes." />

      <div style={{ padding: '0 20px' }}>
        <div style={{
          padding: 18, background: pal.surface, borderRadius: 16,
          border: `0.5px solid ${pal.line}`, boxShadow: LF_SHADOWS.sm,
          marginBottom: 18,
        }}>
          <div style={{ fontSize: 13, color: pal.inkSoft, marginBottom: 12 }}>
            Si quieres conservarlo, lo subo a la nube como una casa nueva. El resto de tus dispositivos lo verán.
          </div>
          {counts && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Row icon="🥑" label="Items en la nevera" n={counts.items} pal={pal} />
              <Row icon="🍳" label="Recetas" n={counts.recipes} pal={pal} />
              <Row icon="🛒" label="Lista de la compra" n={counts.shopping} pal={pal} />
              <Row icon="📋" label="Menú semanal" n={counts.menuPlan} pal={pal} />
              <Row icon="📖" label="Detalles de recetas" n={counts.recipeDetails} pal={pal} />
            </div>
          )}
        </div>

        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: pal.inkSoft, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>
            Nombre de la casa nueva
          </div>
          <input value={householdName} onChange={(e) => setHouseholdName(e.target.value)}
            placeholder="Mi casa"
            style={{
              width: '100%', padding: '14px 16px', fontSize: 15,
              background: pal.surface, border: `1px solid ${pal.line}`,
              borderRadius: 12, color: pal.ink, outline: 'none',
            }} />
        </div>

        <Button tone="green" size="lg" fullWidth onClick={doImport}
          disabled={busy || !householdName.trim() || total === 0}>
          {busy ? 'Subiendo…' : `Importar ${total} elementos`}
        </Button>
        <button onClick={skipImport} disabled={busy} style={{
          width: '100%', marginTop: 12, padding: 12, background: 'transparent',
          border: 'none', color: pal.inkSoft, fontSize: 13, fontWeight: 600,
          cursor: 'pointer',
        }}>
          Descartar y empezar de cero
        </button>
      </div>
    </Screen>
  );
}

const Row = ({ icon, label, n, pal }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
    <span style={{ fontSize: 18, width: 26 }}>{icon}</span>
    <div style={{ flex: 1, fontSize: 13, color: pal.ink }}>{label}</div>
    <div style={{ fontSize: 14, fontWeight: 700, color: n > 0 ? pal.primary : pal.inkFaint }}>
      {n}
    </div>
  </div>
);
