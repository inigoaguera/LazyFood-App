import React from 'react';

const P = {
  home: (<><path d="M3 11.5L12 4l9 7.5"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/></>),
  search: (<><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></>),
  plus: (<path d="M12 5v14M5 12h14"/>),
  minus: (<path d="M5 12h14"/>),
  close: (<path d="M6 6l12 12M18 6L6 18"/>),
  chevronLeft: (<path d="M15 5l-7 7 7 7"/>),
  chevronRight: (<path d="M9 5l7 7-7 7"/>),
  chevronDown: (<path d="M5 9l7 7 7-7"/>),
  chevronUp: (<path d="M5 15l7-7 7 7"/>),
  camera: (<><path d="M4 8a2 2 0 0 1 2-2h2l1.5-2h5L16 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="12" cy="12.5" r="3.5"/></>),
  scan: (<><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M4 12h16"/></>),
  list: (<><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></>),
  chef: (<><path d="M7 11a3 3 0 1 1 .5-5.96 3 3 0 0 1 5.8-1.6A3 3 0 0 1 17 5a3 3 0 0 1 0 6v7a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1z"/><path d="M7 14h10"/></>),
  sparkle: (<><path d="M12 3l1.5 4L18 8.5 13.5 10 12 14l-1.5-4L6 8.5 10.5 7z"/><path d="M18 15l.7 1.8L20.5 17.5 18.7 18.2 18 20l-.7-1.8L15.5 17.5 17.3 16.8z"/></>),
  receipt: (<><path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 21z"/><path d="M9 8h6M9 12h6M9 16h4"/></>),
  cart: (<><path d="M3 4h2l2.4 10.5a2 2 0 0 0 2 1.5h7.2a2 2 0 0 0 2-1.5L20 7H6"/><circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/></>),
  chart: (<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>),
  coin: (<><circle cx="12" cy="12" r="8"/><path d="M12 7v10M9.5 9.5c0-1 1-1.8 2.5-1.8s2.5.8 2.5 2-1 1.8-2.5 1.8-2.5.8-2.5 2 1 2 2.5 2 2.5-.8 2.5-1.8"/></>),
  user: (<><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></>),
  settings: (<><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></>),
  bell: (<><path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9z"/><path d="M10 21a2 2 0 0 0 4 0"/></>),
  clock: (<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>),
  fire: (<path d="M12 3s2 3 2 6-2 3-2 5 2 2 2 2-5 1-5-4c0-3 2-4 2-6S9 3 9 3s0 3-2 5-2 4-2 5c0 4 3 6 7 6s7-2 7-6c0-3-2-3-3-6s-2-6-4-6z"/>),
  drop: (<path d="M12 3s-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11z"/>),
  snowflake: (<><path d="M12 2v20M4.2 7l15.6 10M4.2 17l15.6-10"/><path d="M12 5l-2-2M12 5l2-2M12 19l-2 2M12 19l2 2M5.8 8.2l-2.6-.2M5.8 8.2l.2-2.6M18.2 15.8l2.6.2M18.2 15.8l-.2 2.6M5.8 15.8l.2 2.6M5.8 15.8l-2.6.2M18.2 8.2l-.2-2.6M18.2 8.2l2.6-.2"/></>),
  leaf: (<><path d="M4 20s0-10 8-14c6-3 8 1 8 1s-2 11-8 13c-4 1.3-8 0-8 0z"/><path d="M4 20c2-6 6-10 14-14"/></>),
  box: (<><path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/></>),
  location: (<><circle cx="12" cy="10" r="3"/><path d="M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z"/></>),
  calendar: (<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></>),
  arrowRight: (<path d="M5 12h14M13 5l7 7-7 7"/>),
  arrowLeft: (<path d="M19 12H5M11 5l-7 7 7 7"/>),
  trash: (<><path d="M4 7h16M10 7V4h4v3M6 7v13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7"/><path d="M10 11v6M14 11v6"/></>),
  pencil: (<><path d="M4 20l4-1 11-11-3-3L5 16l-1 4z"/><path d="M14 6l3 3"/></>),
  move: (<><path d="M12 3v18M3 12h18"/><path d="M8 7l4-4 4 4M7 8l-4 4 4 4M17 8l4 4-4 4M8 17l4 4 4-4"/></>),
  heart: (<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>),
  star: (<path d="M12 3l2.6 6 6.4.6-4.9 4.3 1.5 6.3L12 17l-5.6 3.2L8 14l-4.9-4.3 6.4-.6z"/>),
  check: (<path d="M5 12l5 5L20 7"/>),
  bolt: (<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>),
  tag: (<><path d="M20 12l-8 8-9-9V3h8z"/><circle cx="7" cy="7" r="1.5"/></>),
  filter: (<path d="M3 5h18M6 12h12M10 19h4"/>),
  more: (<><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></>),
  grip: (<><circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/></>),
};

export default function LFIcon({ name, size = 22, color = 'currentColor', fill = 'none', strokeWidth = 1.8, style }) {
  const path = P[name];
  if (!path) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color}
         strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
         style={{ display: 'inline-block', flexShrink: 0, ...style }}>
      {path}
    </svg>
  );
}
