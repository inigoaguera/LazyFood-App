// Wrapper minimalista de Brevo (https://www.brevo.com/) — antes Sendinblue.
// Migrado desde Resend (mayo 2026) porque Brevo permite verificar un email único
// como sender sin necesidad de poseer un dominio.
//
// Secrets requeridos en el Worker:
//   BREVO_API_KEY        → la API key xkeysib-... del panel de Brevo
//   RESEND_FROM_EMAIL    → el email verificado como "single sender" en Brevo
//                          (nombre legacy del secret; mantenido por simplicidad)

// Textos del email de acceso. El idioma lo elige el cliente al pedir el código
// (`lang` en /auth/request); cualquier valor desconocido cae a castellano.
const COPY = {
  es: {
    subject: 'Tu acceso a LazyFood 🥑',
    title: 'Tu acceso a LazyFood',
    codeIntro: 'Código de acceso (vuelve a la app y pégalo):',
    or: '— o si prefieres —',
    tapHint: 'Toca el botón en el mismo móvil donde quieras usar la app.',
    button: 'Entrar con un click',
    footer: 'El código y el link caducan en 15 minutos. Si no fuiste tú quien lo pidió, ignora este email.',
  },
  en: {
    subject: 'Your LazyFood sign-in 🥑',
    title: 'Your LazyFood sign-in',
    codeIntro: 'Your sign-in code (go back to the app and paste it):',
    or: '— or if you prefer —',
    tapHint: 'Tap the button on the same phone where you want to use the app.',
    button: 'Sign in with one tap',
    footer: "The code and the link expire in 15 minutes. If you didn't ask for this, just ignore this email.",
  },
};

export async function sendMagicLink(env, email, token, code, lang = 'es') {
  const c = COPY[lang] || COPY.es;
  const url = `${env.APP_URL || 'https://lazyfood.pages.dev'}/?token=${encodeURIComponent(token)}`;
  const html = `
    <div lang="${lang}" style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #F5F1E8; border-radius: 16px;">
      <div style="text-align: center; font-size: 48px;">🥑</div>
      <h1 style="color: #1F2A1C; font-size: 22px; text-align: center; margin: 12px 0 6px">${c.title}</h1>
      ${code ? `
      <p style="color: #5C6B55; text-align: center; font-size: 14px; line-height: 1.5; margin: 0 0 8px">
        ${c.codeIntro}
      </p>
      <div style="text-align: center; margin: 0 0 24px">
        <span style="display: inline-block; padding: 14px 28px; background: #fff; border: 2px solid #4A7C3A; border-radius: 14px; font-family: ui-monospace, monospace; font-size: 28px; font-weight: 700; letter-spacing: 0.15em; color: #1F2A1C">
          ${code}
        </span>
      </div>
      <p style="color: #9AA695; text-align: center; font-size: 12px; margin: 0 0 16px">
        ${c.or}
      </p>
      ` : `
      <p style="color: #5C6B55; text-align: center; font-size: 14px; line-height: 1.5; margin: 0 0 24px">
        ${c.tapHint}
      </p>
      `}
      <p style="text-align: center; margin: 0 0 24px">
        <a href="${url}" style="display: inline-block; padding: 14px 24px; background: #4A7C3A; color: #fff; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 15px">
          ${c.button}
        </a>
      </p>
      <p style="color: #9AA695; font-size: 12px; text-align: center; margin: 0">
        ${c.footer}
      </p>
    </div>
  `;

  const fromEmail = env.RESEND_FROM_EMAIL;
  if (!fromEmail) throw new Error('RESEND_FROM_EMAIL no configurado');
  if (!env.BREVO_API_KEY) throw new Error('BREVO_API_KEY no configurado');

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': env.BREVO_API_KEY,
      'Content-Type': 'application/json',
      'accept': 'application/json',
    },
    body: JSON.stringify({
      sender: { email: fromEmail, name: 'LazyFood 🥑' },
      to: [{ email }],
      subject: c.subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Brevo error ${res.status}: ${errText}`);
  }
  return res.json();
}
