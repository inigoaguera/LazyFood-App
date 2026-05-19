import React, { useEffect, useState } from 'react';
import { useLF } from '../components/ctx.js';
import { Screen, Header, IconBtn, Card, Button, toast } from '../components/base.jsx';
import { LF_PALETTES, LF_SHADOWS } from '../tokens/palettes.js';
import { LF_FONTS } from '../tokens/fonts.js';
import LFIcon from '../icons/LFIcon.jsx';
import {
  fetchMe, getHousehold, patchMe, patchHousehold,
  leaveOrKick, deleteHousehold, logout,
} from '../api/session.js';
import { bulkImport, create as resourceCreate, remove as resourceRemove } from '../api/resources.js';
import { syncHousehold } from '../api/sync.js';
import { buildSamplePayload } from '../data/seed.js';
import { useCategories } from '../util/categories.js';
import InviteShare from './InviteShare.jsx';

const HOUSEHOLD_COLORS = ['#4A7C3A', '#0F9D6E', '#C25A3C', '#7FB0C4', '#E8A838', '#5DB8C4', '#B85AAB'];
const AVATAR_EMOJIS = ['🥑', '🦊', '🐱', '🐶', '🐻', '🐼', '🦁', '🐯', '🐸', '🐵', '🦄', '🐝', '🍓', '🍑', '🥕', '🥬', '🍕', '🍔', '☕', '🌮', '🌶️', '🍳', '🍰', '🧁'];

export default function Profile({ onBack, onSwitchHousehold, onLogout }) {
  const { pal, fonts, currentHousehold, me: cachedMe } = useLF();
  const [me, setMe] = useState(cachedMe || null);
  const [household, setHousehold] = useState(null);
  const [showInvite, setShowInvite] = useState(false);
  const [editingUser, setEditingUser] = useState(false);
  const [editingHousehold, setEditingHousehold] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchMe().then((m) => { if (!cancelled) setMe(m); }).catch(() => {});
    if (currentHousehold) {
      getHousehold(currentHousehold)
        .then((h) => { if (!cancelled) setHousehold(h); })
        .catch((e) => { if (!cancelled) toast(e?.message || 'Error', 'error'); });
    }
    return () => { cancelled = true; };
  }, [currentHousehold]);

  const updatePref = async (k, v) => {
    const next = { ...(me?.prefs || {}), [k]: v };
    await patchMe({ prefs: next });
    setMe((cur) => cur ? { ...cur, prefs: next } : cur);
  };

  const handleLeave = async () => {
    if (!confirm(`¿Salir de "${household.name}"? Perderás el acceso a esta casa.`)) return;
    try {
      await leaveOrKick(household.id, me.id);
      toast('Saliste de la casa');
      onSwitchHousehold?.();
    } catch (e) { toast(e?.message || 'Error', 'error'); }
  };

  const handleKick = async (target) => {
    if (!confirm(`¿Expulsar a ${target.name || target.email} de "${household.name}"?`)) return;
    try {
      await leaveOrKick(household.id, target.id);
      const refreshed = await getHousehold(household.id);
      setHousehold(refreshed);
      toast(`${target.name || target.email} expulsado`);
    } catch (e) { toast(e?.message || 'Error', 'error'); }
  };

  const handleImportSample = async () => {
    if (!household) return;
    if (!confirm(`¿Importar 23 items + 11 recetas + 6 cosas de la lista a "${household.name}"?\n\nSe AÑADEN a lo que ya tengas (no reemplaza). Si quieres empezar limpio, borra primero los items existentes.`)) return;
    try {
      const res = await bulkImport(household.id, buildSamplePayload());
      await syncHousehold(household.id, { full: true });
      const total = Object.values(res?.counts || {}).reduce((a, b) => a + b, 0);
      toast(`Importados ${total} elementos 🎉`);
    } catch (e) { toast(e?.message || 'Error', 'error'); }
  };

  const handleDeleteHousehold = async () => {
    if (!confirm(`¿Borrar "${household.name}" PARA SIEMPRE? Se perderán todos los items, recetas, lista, gastos y menú. Esta acción no se puede deshacer.`)) return;
    if (!confirm('Última oportunidad. ¿Seguro?')) return;
    try {
      await deleteHousehold(household.id);
      toast('Casa borrada');
      onSwitchHousehold?.();
    } catch (e) { toast(e?.message || 'Error', 'error'); }
  };

  const handleLogout = async () => {
    if (!confirm('¿Cerrar sesión? Tendrás que volver a meter tu email.')) return;
    await logout();
    onLogout?.();
  };

  const initial = (me?.name || me?.email || '?').charAt(0).toUpperCase();
  const userPrefs = me?.prefs || {};
  const isOwner = household?.role === 'owner';

  return (
    <Screen>
      <Header big title="Perfil" left={<IconBtn icon="chevronLeft" onClick={onBack} />} />
      <div style={{ padding: '0 20px' }}>

        {/* ─── Mi cuenta ──────────────────────────────────────── */}
        <SectionTitle>Mi cuenta</SectionTitle>
        <Card style={{ padding: 18, marginBottom: 16 }}>
          {!editingUser ? (
            <UserSummary me={me} avatarFallback={initial} pal={pal} fonts={fonts}
              onEdit={() => setEditingUser(true)} />
          ) : (
            <UserEditor me={me} pal={pal} fonts={fonts}
              onSave={async (patch) => {
                try {
                  await patchMe(patch);
                  const m = await fetchMe(); setMe(m);
                  setEditingUser(false);
                  toast('Cambios guardados');
                } catch (e) { toast(e?.message || 'Error', 'error'); }
              }}
              onCancel={() => setEditingUser(false)} />
          )}
        </Card>

        {/* ─── Esta casa ──────────────────────────────────────── */}
        {household && (
          <>
            <SectionTitle>Esta casa</SectionTitle>
            <Card style={{ padding: 16, marginBottom: 12 }}>
              {!editingHousehold ? (
                <HouseholdSummary household={household} pal={pal} fonts={fonts}
                  canEdit={isOwner} onEdit={() => setEditingHousehold(true)} />
              ) : (
                <HouseholdEditor household={household} isOwner={isOwner} pal={pal} fonts={fonts}
                  onSave={async (patch) => {
                    try {
                      await patchHousehold(household.id, patch);
                      const refreshed = await getHousehold(household.id);
                      setHousehold(refreshed);
                      await fetchMe();
                      setEditingHousehold(false);
                      toast('Casa actualizada');
                    } catch (e) { toast(e?.message || 'Error', 'error'); }
                  }}
                  onCancel={() => setEditingHousehold(false)} />
              )}
            </Card>

            {/* Miembros */}
            <Card style={{ padding: 14, marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: pal.inkSoft, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 10 }}>
                Miembros ({household.members?.length || 0})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {(household.members || []).map((m, i, arr) => (
                  <div key={m.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 4px',
                    borderBottom: i < arr.length - 1 ? `0.5px solid ${pal.line}` : 'none',
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 18, background: pal.primarySoft,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: m.avatar ? 18 : 14,
                      color: pal.primary, fontWeight: 700,
                    }}>{m.avatar || (m.name || m.email || '?').charAt(0).toUpperCase()}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: pal.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.name || m.email}{m.id === me?.id && ' (tú)'}
                      </div>
                      <div style={{ fontSize: 11, color: pal.inkFaint }}>
                        {m.role === 'owner' ? '👑 Propietario' : 'Miembro'}
                      </div>
                    </div>
                    {isOwner && m.id !== me?.id && (
                      <button onClick={() => handleKick(m)} style={{
                        background: 'transparent', border: 'none', color: pal.danger,
                        fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: '4px 8px',
                      }}>Expulsar</button>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            {/* Acciones de casa */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <Button tone="green" size="md" icon="plus" fullWidth onClick={() => setShowInvite(true)}>
                Invitar
              </Button>
              <Button tone="soft" size="md" fullWidth onClick={onSwitchHousehold}>
                Cambiar casa
              </Button>
            </div>

            <button onClick={handleImportSample} style={{
              width: '100%', padding: 12, marginBottom: 8,
              background: pal.surface, border: `0.5px solid ${pal.line}`, borderRadius: 12,
              color: pal.ink, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <span>🌱</span>
              <span>Importar datos de prueba</span>
            </button>

            {(household.members?.length || 0) > 1 && (
              <button onClick={handleLeave} style={{
                width: '100%', padding: 12, marginBottom: 8,
                background: 'transparent', border: `0.5px solid ${pal.line}`, borderRadius: 12,
                color: pal.inkSoft, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                Salir de "{household.name}"
              </button>
            )}

            {isOwner && (
              <button onClick={handleDeleteHousehold} style={{
                width: '100%', padding: 12, marginBottom: 18,
                background: pal.dangerSoft, border: 'none', borderRadius: 12,
                color: pal.danger, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}>
                🗑 Borrar casa para siempre
              </button>
            )}
          </>
        )}

        {/* ─── Categorías de la casa ──────────────────────────── */}
        {household && (
          <>
            <SectionTitle>Categorías de la casa</SectionTitle>
            <CustomCategoriesSection hid={household.id} />
          </>
        )}

        {/* ─── Tema ───────────────────────────────────────────── */}
        <SectionTitle>Tema (tuyo, no compartido)</SectionTitle>
        <Card style={{ padding: 14, marginBottom: 12 }}>
          <Label>Paleta</Label>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            {Object.entries(LF_PALETTES).map(([k, v]) => (
              <button key={k} onClick={() => updatePref('palette', k)} style={{
                flex: 1, padding: '10px 6px', borderRadius: 12, cursor: 'pointer',
                background: v.surface,
                border: (userPrefs.palette || 'huerto') === k ? `2px solid ${pal.ink}` : `0.5px solid ${pal.line}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  <div style={{ width: 14, height: 14, borderRadius: 7, background: v.primary }}/>
                  <div style={{ width: 14, height: 14, borderRadius: 7, background: v.accent }}/>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: v.ink }}>{v.name}</span>
              </button>
            ))}
          </div>
        </Card>
        <Card style={{ padding: 14, marginBottom: 18 }}>
          <Label>Tipografía</Label>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {Object.entries(LF_FONTS).map(([k, v]) => (
              <button key={k} onClick={() => updatePref('font', k)} style={{
                flex: '1 1 30%', padding: '10px 8px', borderRadius: 10, cursor: 'pointer',
                background: pal.bg,
                border: (userPrefs.font || 'playful') === k ? `2px solid ${pal.ink}` : `0.5px solid ${pal.line}`,
                fontFamily: v.display, fontSize: 14, fontWeight: 700, color: pal.ink,
              }}>{v.name}</button>
            ))}
          </div>
        </Card>

        {/* ─── Sesión ─────────────────────────────────────────── */}
        <SectionTitle>Sesión</SectionTitle>
        <button onClick={handleLogout} style={{
          width: '100%', padding: 14, background: pal.surface,
          border: `0.5px solid ${pal.line}`, borderRadius: 14,
          color: pal.danger, fontSize: 14, fontWeight: 600,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <LFIcon name="arrowLeft" size={16} color={pal.danger} />
          Cerrar sesión
        </button>
        <div style={{ height: 30 }}/>
      </div>

      {showInvite && household && (
        <InviteShare householdId={household.id} householdName={household.name}
          onClose={() => setShowInvite(false)} />
      )}
    </Screen>
  );
}

// ─── Componentes auxiliares ──────────────────────────────────────────

const UserSummary = ({ me, avatarFallback, pal, fonts, onEdit }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
    <div style={{
      width: 64, height: 64, borderRadius: 32,
      background: me?.avatar ? pal.primarySoft : `linear-gradient(135deg, ${pal.primary}, ${pal.accent})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontFamily: fonts.display, fontSize: me?.avatar ? 32 : 24, fontWeight: 800,
    }}>{me?.avatar || avatarFallback}</div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 18, color: pal.ink }}>
        {me?.name || 'Sin nombre'}
      </div>
      <div style={{ fontSize: 12, color: pal.inkSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {me?.email}
      </div>
    </div>
    <IconBtn icon="pencil" tone="soft" onClick={onEdit} />
  </div>
);

const UserEditor = ({ me, pal, fonts, onSave, onCancel }) => {
  const [name, setName] = useState(me?.name || '');
  const [avatar, setAvatar] = useState(me?.avatar || '');
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
        <div style={{
          width: 64, height: 64, borderRadius: 32,
          background: avatar ? pal.primarySoft : `linear-gradient(135deg, ${pal.primary}, ${pal.accent})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontFamily: fonts.display, fontSize: avatar ? 32 : 24, fontWeight: 800, flexShrink: 0,
        }}>{avatar || (name || me?.email || '?').charAt(0).toUpperCase()}</div>
        <div style={{ flex: 1 }}>
          <Label>Tu nombre</Label>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Iñigo"
            style={{
              width: '100%', padding: '10px 12px', fontSize: 15,
              background: pal.bg, border: `1px solid ${pal.line}`,
              borderRadius: 10, color: pal.ink, outline: 'none', marginTop: 6,
            }} />
        </div>
      </div>
      <Label>Avatar</Label>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6, marginTop: 8,
      }}>
        <button onClick={() => setAvatar('')} style={{
          aspectRatio: '1', borderRadius: 10, cursor: 'pointer', fontSize: 11,
          background: !avatar ? pal.ink : pal.bg, color: !avatar ? pal.bg : pal.inkSoft,
          border: `0.5px solid ${pal.line}`,
        }}>—</button>
        {AVATAR_EMOJIS.map((e) => (
          <button key={e} onClick={() => setAvatar(e)} style={{
            aspectRatio: '1', borderRadius: 10, cursor: 'pointer', fontSize: 22,
            background: avatar === e ? pal.primarySoft : pal.bg,
            border: avatar === e ? `2px solid ${pal.primary}` : `0.5px solid ${pal.line}`,
          }}>{e}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <Button tone="green" size="md" fullWidth onClick={() => onSave({ name: name.trim(), avatar })}>
          Guardar
        </Button>
        <Button tone="soft" size="md" fullWidth onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
};

const HouseholdSummary = ({ household, pal, fonts, canEdit, onEdit }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
    <div style={{
      width: 44, height: 44, borderRadius: 22, flexShrink: 0,
      background: household.color, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: fonts.display, fontSize: 18, fontWeight: 800,
    }}>{(household.name || '?').charAt(0).toUpperCase()}</div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: fonts.display, fontSize: 17, fontWeight: 700, color: pal.ink }}>
        {household.name}
      </div>
      <div style={{ fontSize: 11, color: pal.inkSoft }}>
        Presupuesto: {household.budget ? `${household.budget}€/mes` : 'sin definir'}
      </div>
    </div>
    {canEdit && <IconBtn icon="pencil" tone="soft" onClick={onEdit} />}
  </div>
);

const HouseholdEditor = ({ household, isOwner, pal, fonts, onSave, onCancel }) => {
  const [name, setName] = useState(household.name || '');
  const [color, setColor] = useState(household.color || HOUSEHOLD_COLORS[0]);
  const [budget, setBudget] = useState(household.budget != null ? String(household.budget) : '');

  const save = () => {
    const patch = {};
    if (isOwner) {
      if (name.trim() && name !== household.name) patch.name = name.trim();
      if (color !== household.color) patch.color = color;
    }
    const budgetNum = budget === '' ? null : Number(budget);
    if (budgetNum !== household.budget && !Number.isNaN(budgetNum)) {
      patch.budget = budgetNum;
    }
    onSave(patch);
  };

  return (
    <div>
      <Label>{isOwner ? 'Nombre de la casa' : 'Nombre (sólo el owner puede cambiarlo)'}</Label>
      <input value={name} onChange={(e) => setName(e.target.value)}
        disabled={!isOwner}
        style={{
          width: '100%', padding: '10px 12px', fontSize: 15,
          background: isOwner ? pal.bg : pal.surface,
          border: `1px solid ${pal.line}`, borderRadius: 10,
          color: pal.ink, outline: 'none', marginTop: 6, opacity: isOwner ? 1 : 0.7,
        }} />

      {isOwner && (
        <div style={{ marginTop: 14 }}>
          <Label>Color</Label>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {HOUSEHOLD_COLORS.map((c) => (
              <button key={c} onClick={() => setColor(c)} style={{
                width: 36, height: 36, borderRadius: 18,
                background: c, cursor: 'pointer',
                border: color === c ? `3px solid ${pal.ink}` : `2px solid ${pal.line}`,
                padding: 0,
              }}/>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        <Label>Presupuesto mensual (€)</Label>
        <input type="number" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)}
          placeholder="400"
          style={{
            width: '100%', padding: '10px 12px', fontSize: 15,
            background: pal.bg, border: `1px solid ${pal.line}`,
            borderRadius: 10, color: pal.ink, outline: 'none', marginTop: 6,
          }} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <Button tone="green" size="md" fullWidth onClick={save}>Guardar</Button>
        <Button tone="soft" size="md" fullWidth onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
};

const SectionTitle = ({ children }) => {
  const { pal } = useLF();
  return <div style={{ fontSize: 12, fontWeight: 700, color: pal.inkSoft, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '8px 4px' }}>{children}</div>;
};

const CAT_COLORS = ['#E6D5A8','#A8C9A0','#E8B5B0','#D4A5A5','#A8C4DB','#E8CCA0','#C4B8A5','#E8B5A8','#D4B58A','#B0C7D4','#E8BB8A','#BFE3EA','#C5DCA0','#E8C8C0','#D080A8'];

const CustomCategoriesSection = ({ hid }) => {
  const { pal, fonts } = useLF();
  const all = useCategories(hid);
  // Sólo nos interesan las custom (las default no tienen flag custom)
  const customs = all.filter((c) => c.custom);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(CAT_COLORS[0]);
  const [emoji, setEmoji] = useState('');

  const create = async () => {
    if (!name.trim()) return;
    try {
      await resourceCreate('categories', hid, {
        name: name.trim(), color, emoji: emoji.trim() || null,
      });
      await syncHousehold(hid);
      toast(`Categoría "${name}" creada`);
      setName(''); setEmoji(''); setColor(CAT_COLORS[0]); setAdding(false);
    } catch (e) { toast(e?.message || 'Error', 'error'); }
  };

  const remove = async (cat) => {
    if (!confirm(`¿Borrar la categoría "${cat.label}"? Los items que la usan se quedan sin categoría.`)) return;
    try {
      await resourceRemove('categories', hid, cat.id);
      await syncHousehold(hid);
      toast('Categoría eliminada');
    } catch (e) { toast(e?.message || 'Error', 'error'); }
  };

  return (
    <Card style={{ padding: 14, marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: pal.inkSoft, marginBottom: 10, lineHeight: 1.4 }}>
        Las 12 categorías por defecto están siempre disponibles. Aquí puedes añadir
        las tuyas (postres, bebés, salsas caseras…) y las verán todos los miembros.
      </div>
      {customs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
          {customs.map((c) => (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', background: pal.bg, borderRadius: 10,
              border: `0.5px solid ${pal.line}`,
            }}>
              <span style={{ width: 18, height: 18, borderRadius: 9, background: c.color, flexShrink: 0 }}/>
              <span style={{ fontSize: 16 }}>{c.emoji || ''}</span>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: pal.ink }}>{c.label}</div>
              <button onClick={() => remove(c)} style={{
                background: 'transparent', border: 'none', color: pal.danger,
                fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: '4px 8px',
              }}>Eliminar</button>
            </div>
          ))}
        </div>
      )}
      {!adding ? (
        <button onClick={() => setAdding(true)} style={{
          width: '100%', padding: 10, borderRadius: 10,
          background: pal.primarySoft, color: pal.primary, border: 'none',
          fontSize: 12, fontWeight: 700, cursor: 'pointer',
        }}>+ Añadir categoría</button>
      ) : (
        <div style={{ padding: 10, background: pal.bg, borderRadius: 10, border: `0.5px solid ${pal.line}` }}>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') create(); if (e.key === 'Escape') setAdding(false); }}
            placeholder="Nombre (postres, bebés…)"
            style={{
              width: '100%', padding: 10, fontSize: 14, marginBottom: 10,
              background: pal.surface, border: `0.5px solid ${pal.line}`,
              borderRadius: 8, color: pal.ink, outline: 'none',
            }} />
          <input value={emoji} onChange={(e) => setEmoji(e.target.value)}
            placeholder="Emoji (opcional)" maxLength={3}
            style={{
              width: 80, padding: 10, fontSize: 18, marginBottom: 10,
              background: pal.surface, border: `0.5px solid ${pal.line}`,
              borderRadius: 8, color: pal.ink, outline: 'none', textAlign: 'center',
            }} />
          <div style={{ fontSize: 10, fontWeight: 700, color: pal.inkSoft, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>Color</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {CAT_COLORS.map((c) => (
              <button key={c} onClick={() => setColor(c)} style={{
                width: 28, height: 28, borderRadius: 14, background: c,
                border: color === c ? `2px solid ${pal.ink}` : `0.5px solid ${pal.line}`,
                cursor: 'pointer', padding: 0,
              }}/>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={create} disabled={!name.trim()} style={{
              flex: 1, padding: 10, background: pal.primary, color: '#fff',
              border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700,
              cursor: name.trim() ? 'pointer' : 'default', opacity: name.trim() ? 1 : 0.5,
            }}>Crear</button>
            <button onClick={() => { setAdding(false); setName(''); setEmoji(''); }} style={{
              flex: 1, padding: 10, background: 'transparent', color: pal.inkSoft,
              border: `0.5px solid ${pal.line}`, borderRadius: 10, fontSize: 13, fontWeight: 600,
              cursor: 'pointer',
            }}>Cancelar</button>
          </div>
        </div>
      )}
    </Card>
  );
};
const Label = ({ children }) => {
  const { pal } = useLF();
  return <div style={{ fontSize: 12, fontWeight: 700, color: pal.inkSoft }}>{children}</div>;
};
