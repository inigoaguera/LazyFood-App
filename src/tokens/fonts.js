export const LF_FONTS = {
  playful: {
    name: 'Playful',
    display: "'Fraunces', Georgia, serif",
    body: "'DM Sans', system-ui, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, monospace",
    googleImport: 'family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700;9..144,900&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500',
  },
  clean: {
    name: 'Clean',
    display: "'Instrument Serif', Georgia, serif",
    body: "'Instrument Sans', system-ui, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, monospace",
    googleImport: 'family=Instrument+Serif:ital@0;1&family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500',
  },
  rounded: {
    name: 'Rounded',
    display: "'Nunito', system-ui, sans-serif",
    body: "'Nunito', system-ui, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, monospace",
    googleImport: 'family=Nunito:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500',
  },
};

const loaded = new Set();
export function lfEnsureFont(fontKey) {
  if (loaded.has(fontKey)) return;
  loaded.add(fontKey);
  const f = LF_FONTS[fontKey];
  if (!f) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?${f.googleImport}&display=swap`;
  document.head.appendChild(link);
}
