import React, { useState } from 'react';
import { useLF } from '../components/ctx.js';
import { Button, toast } from '../components/base.jsx';
import { LF_SHADOWS } from '../tokens/palettes.js';
import { createInvite } from '../api/session.js';
import { errMsg } from '../i18n/index.js';

const INVITE_DAYS = 7;

// Modal-like componente para Profile.
export default function InviteShare({ householdId, householdName, onClose }) {
  const { pal, fonts, t } = useLF();
  const [invite, setInvite] = useState(null);
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      const inv = await createInvite(householdId, { ttlHours: INVITE_DAYS * 24, maxUses: 5 });
      setInvite(inv);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally { setBusy(false); }
  };

  const share = async () => {
    if (!invite) return;
    const text = t('household.invite.shareText', { name: householdName, url: invite.url });
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
      toast(t('household.invite.linkCopied'));
    } catch {
      toast(t('household.invite.copyFailed'), 'error');
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
          {t('household.invite.title', { name: householdName })}
        </h2>
        <p style={{ color: pal.inkSoft, fontSize: 13, margin: '0 0 18px' }}>
          {t('household.invite.intro')}
        </p>

        {!invite ? (
          <Button tone="green" size="lg" fullWidth onClick={generate} disabled={busy}>
            {busy ? t('household.invite.generating') : t('household.invite.generate')}
          </Button>
        ) : (
          <div>
            <div style={{
              padding: 14, background: pal.surface, border: `1px solid ${pal.line}`,
              borderRadius: 12, fontSize: 13, color: pal.ink,
              wordBreak: 'break-all', boxShadow: LF_SHADOWS.sm,
            }}>{invite.url}</div>
            <div style={{ marginTop: 8, fontSize: 11, color: pal.inkFaint }}>
              {t('household.invite.expiry', { days: INVITE_DAYS, n: invite.maxUses })}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <Button tone="green" size="md" fullWidth icon="sparkle" onClick={share}>{t('common.share')}</Button>
              <Button tone="soft" size="md" fullWidth onClick={copy}>{t('common.copy')}</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
