import React, { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db.js';
import { useLF } from '../components/ctx.js';
import { LF_SHADOWS } from '../tokens/palettes.js';
import { Button } from '../components/base.jsx';
import { RecipeThumb } from '../data/recipeThumbs.jsx';

// Modal que se abre al tocar un item de "úsalos esta semana".
// Muestra primero las recetas guardadas que mencionan ese ingrediente.
// "Más ideas con IA" lleva al chat de Antojos con prompt automático.
export default function UseIngredient({ item, hid, onOpenRecipe, onOpenChat, onClose }) {
  const { pal, fonts } = useLF();
  const recipes = useLiveQuery(
    () => hid ? db.recipes.where({ householdId: hid }).toArray() : Promise.resolve([]),
    [hid], []
  );
  const recipeDetails = useLiveQuery(
    () => hid ? db.recipeDetails.where({ householdId: hid }).toArray() : Promise.resolve([]),
    [hid], []
  );

  // Recetas guardadas que mencionan el ingrediente (linked or fuzzy)
  const matched = useMemo(() => {
    const detailsByName = new Map(recipeDetails.map((d) => [d.matchName || d.name, d]));
    const q = item.name.toLowerCase().split(' ')[0];
    return recipes.filter((r) => {
      const det = detailsByName.get(r.name);
      if (!det?.ingredients) return false;
      return det.ingredients.some((ing) => {
        if (ing.itemId === item.id) return true;
        const ingName = (ing.name || '').toLowerCase();
        return ingName.includes(q) || q.includes(ingName.split(' ')[0]);
      });
    });
  }, [recipes, recipeDetails, item]);

  const askAi = () => {
    const prompt = `Recetas usando "${item.name}" porque me caduca pronto. Comidas/cenas completas.`;
    onClose();
    onOpenChat?.(prompt);
  };

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 50,
      background: 'rgba(20,25,18,0.45)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-end',
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxHeight: '90%', background: pal.bg,
        borderTopLeftRadius: 28, borderTopRightRadius: 28,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        animation: 'slideUp .28s cubic-bezier(.3,.7,.4,1)',
      }}>
        <div style={{ padding: '10px 0 0', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: pal.lineStrong }}/>
        </div>
        <div style={{ padding: '14px 20px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 28, background: pal.accentSoft,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
          }}>{item.emoji}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: pal.accent, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Usa esto pronto
            </div>
            <div style={{ fontFamily: fonts.display, fontSize: 18, fontWeight: 700, color: pal.ink }}>{item.name}</div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 24px' }}>
          {matched.length > 0 && (
            <>
              <SectionLabel pal={pal}>De tus recetas ({matched.length})</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                {matched.map((r) => (
                  <button key={r.id} onClick={() => { onClose(); onOpenRecipe?.(r.id); }} style={{
                    width: '100%', textAlign: 'left',
                    background: pal.surface, borderRadius: 14,
                    border: `0.5px solid ${pal.line}`, boxShadow: LF_SHADOWS.sm,
                    overflow: 'hidden', display: 'flex', alignItems: 'stretch', cursor: 'pointer',
                    padding: 0,
                  }}>
                    <div style={{ width: 80, flexShrink: 0 }}>
                      <RecipeThumb img={r.img} height={80} />
                    </div>
                    <div style={{ flex: 1, padding: '12px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: pal.ink }}>{r.name}</div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 11, color: pal.inkSoft }}>
                        <span>🍳 {r.effort}</span>
                        <span>⏱ {r.time}m</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {matched.length === 0 && (
            <div style={{
              padding: 24, textAlign: 'center', fontSize: 13, color: pal.inkFaint,
              background: pal.surface, borderRadius: 14, border: `0.5px dashed ${pal.lineStrong}`,
              marginBottom: 16,
            }}>
              Aún no tienes recetas guardadas que usen {item.name}. Pídele a la IA que te proponga.
            </div>
          )}
        </div>

        <div style={{
          padding: '12px 18px 20px', background: pal.surface,
          borderTop: `0.5px solid ${pal.line}`,
        }}>
          <Button tone="primary" size="lg" fullWidth icon="sparkle" onClick={askAi}>
            Más ideas con IA
          </Button>
        </div>
      </div>
    </div>
  );
}

const SectionLabel = ({ pal, children }) => (
  <div style={{
    fontSize: 11, fontWeight: 700, color: pal.inkSoft,
    letterSpacing: '0.04em', textTransform: 'uppercase',
    marginBottom: 10, marginTop: 8,
  }}>{children}</div>
);
