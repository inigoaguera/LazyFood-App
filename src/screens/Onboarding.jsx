import React, { useState } from 'react';
import { useLF } from '../components/ctx.js';
import { Button } from '../components/base.jsx';
import { LF_SHADOWS } from '../tokens/palettes.js';
import LFIcon from '../icons/LFIcon.jsx';

const SLIDES = [
  {
    eyebrow: '01 · Bienvenida',
    title: 'Hola, yo soy\nLazyFood 🥑',
    body: 'Gestiono tu nevera para que tú no tengas que pensar. Tu única misión: cocinar (o no).',
    art: 'hello',
  },
  {
    eyebrow: '02 · Escanea y listo',
    title: 'Foto al ticket,\nyo hago el resto.',
    body: 'Apunta al ticket del super y rellenamos tu inventario en segundos. Sin apuntar nada a mano.',
    art: 'ticket',
  },
  {
    eyebrow: '03 · Cocina sin pensar',
    title: '¿Qué hay\npara cenar?',
    body: 'Te propongo recetas con lo que ya tienes. Cero esfuerzo, cero desperdicio.',
    art: 'chef',
  },
];

export default function Onboarding({ onDone }) {
  const { pal, fonts } = useLF();
  const [step, setStep] = useState(0);
  const s = SLIDES[step];
  const last = step === SLIDES.length - 1;
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: pal.bg }}>
      <div style={{ padding: '20px 24px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: fonts.mono, fontSize: 11, color: pal.inkSoft, letterSpacing: '0.05em' }}>
          {s.eyebrow.toUpperCase()}
        </div>
        {!last && <button onClick={onDone} style={{ background: 'transparent', border: 'none', color: pal.inkSoft, fontSize: 13, cursor: 'pointer' }}>Saltar</button>}
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
        <Art variant={s.art} />
      </div>

      <div style={{ padding: '0 28px 20px' }}>
        <h1 style={{
          fontFamily: fonts.display, fontSize: 38, lineHeight: 1.02,
          fontWeight: 700, color: pal.ink, margin: 0,
          whiteSpace: 'pre-line', letterSpacing: '-0.025em',
        }}>{s.title}</h1>
        <p style={{ color: pal.inkSoft, fontSize: 15, lineHeight: 1.5, marginTop: 14 }}>{s.body}</p>
      </div>

      <div style={{ padding: '0 24px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {SLIDES.map((_, i) => (
            <div key={i} style={{
              height: 6, borderRadius: 3,
              width: i === step ? 24 : 6,
              background: i === step ? pal.ink : pal.lineStrong,
              transition: 'all .2s',
            }}/>
          ))}
        </div>
        <Button tone="primary" size="lg" iconRight="arrowRight"
          onClick={() => last ? onDone() : setStep(step + 1)}>
          {last ? 'Empezar' : 'Siguiente'}
        </Button>
      </div>
    </div>
  );
}

const Art = ({ variant }) => {
  const { pal } = useLF();
  if (variant === 'hello') {
    return (
      <div style={{
        width: 260, height: 260, borderRadius: 130,
        background: pal.primarySoft, position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontSize: 130 }}>🥑</div>
        <span style={{ position: 'absolute', top: 20, left: 20, fontSize: 34 }}>✨</span>
        <span style={{ position: 'absolute', bottom: 30, right: 12, fontSize: 28 }}>🥕</span>
        <span style={{ position: 'absolute', top: 40, right: 30, fontSize: 26 }}>🍅</span>
      </div>
    );
  }
  if (variant === 'ticket') {
    return (
      <div style={{ width: 260, height: 260, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: 180, height: 230, background: pal.surface, borderRadius: 14,
          boxShadow: LF_SHADOWS.lg, padding: 20, transform: 'rotate(-6deg)',
          border: `0.5px solid ${pal.line}`,
        }}>
          <div style={{ height: 4, background: pal.ink, width: '40%', borderRadius: 2, marginBottom: 14 }}/>
          {[70, 85, 60, 75, 55, 80, 68].map((w, i) => (
            <div key={i} style={{ height: 3, background: pal.inkFaint, width: `${w}%`, marginBottom: 10, borderRadius: 1.5 }}/>
          ))}
          <div style={{ height: 4, background: pal.accent, width: '50%', borderRadius: 2, marginTop: 18 }}/>
        </div>
        <div style={{
          position: 'absolute', right: 20, bottom: 30,
          width: 90, height: 90, borderRadius: 45,
          background: pal.primary, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: LF_SHADOWS.float, transform: 'rotate(10deg)',
        }}>
          <LFIcon name="scan" size={40} color="#fff" strokeWidth={2} />
        </div>
      </div>
    );
  }
  return (
    <div style={{ width: 260, height: 260, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        width: 200, height: 200, borderRadius: 100,
        background: pal.accentSoft, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontSize: 100 }}>🍳</div>
      </div>
      {[
        { e: '🍝', top: 10, left: 10, rot: -15 },
        { e: '🥘', top: 30, right: 0, rot: 10 },
        { e: '🥗', bottom: 10, left: 20, rot: 8 },
        { e: '🍲', bottom: 30, right: 10, rot: -10 },
      ].map((x, i) => (
        <span key={i} style={{ position: 'absolute', fontSize: 38, transform: `rotate(${x.rot}deg)`, ...x }}>{x.e}</span>
      ))}
    </div>
  );
};
