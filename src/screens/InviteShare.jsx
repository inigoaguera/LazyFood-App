import React, { useState } from 'react';
import { useLF } from '../components/ctx.js';
import { Button, toast } from '../components/base.jsx';
import { LF_SHADOWS } from '../tokens/palettes.js';
import { createInvite } from '../api/session.js';

// Modal-like componente para Profile.
export default function InviteShare({ householdId, householdName, onClose }) {
  const { pal, fonts } = useLF();
  const [invite, setInvite] = useState(null);
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      const inv = await createInvite(householdId, { ttlHours: 7 * 24, maxUses: 5 });
      setInvite(inv);
    } catch (e) {
      toast(e?.message || 'Error', 'error');
    } finally { setBusy(false); }
  };

  const share = async () => {
    if (!invite) return;
    const text = `Te invito a unirte a "${householdName}" en LazyFood: ${invite.url}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'LazyFood', text, url: invite.url }); }
      catch { /* user canceled */ }
    } else {
      await copy();
    }
  };

  const copy = async () => {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.url);
      toast('Link copiado al portapapeles');
    } catch {
      toast('No se pudo copiar', 'error');
    }
  };

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 50,
      background: 'rgba(20,25,18,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-end',
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', background: pal.bg,
        borderTopLeftRadius: 28, borderTopRightRadius: 28,
        padding: '14px 22px 28px', overflow: 'hidden',
        animation: 'slideUp .28s cubic-bezier(.3,.7,.4,1)',
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: pal.lineStrong, margin: '0 auto 12px' }}/>
        <h2 style={{ fontFamily: fonts.display, fontSize: 22, fontWeight: 700, color: pal.ink, margin: '0 0 4px' }}>
          Invitar a {householdName}
        </h2>
        <p style={{ color: pal.inkSoft, fontSize: 13, margin: '0 0 18px' }}>
          Genera un link y compártelo. Cualquiera con el link se une a la casa.
        </p>

        {!invite ? (
          <Button tone="green" size="lg" fullWidth onClick={generate} disabled={busy}>
            {busy ? 'Generando…' : 'Generar link de invitación'}
          </Button>
        ) : (
          <div>
            <div style={{
              padding: 14, background: pal.surface, border: `1px solid ${pal.line}`,
              borderRadius: 12, fontSize: 13, color: pal.ink,
              wordBreak: 'break-all', boxShadow: LF_SHADOWS.sm,
            }}>{invite.url}</div>
            <div style={{ marginTop: 8, fontSize: 11, color: pal.inkFaint }}>
              Caduca en 7 días · Hasta {invite.maxUses} usos
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <Button tone="green" size="md" fullWidth icon="sparkle" onClick={share}>Compartir</Button>
              <Button tone="soft" size="md" fullWidth onClick={copy}>Copiar</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
