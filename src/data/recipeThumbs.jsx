// Mapas de gradiente + emoji para las "imágenes" de cada receta.
// Vive aparte para evitar imports circulares entre Recipes.jsx ↔ RecipeEditor.jsx.

import React from 'react';

export const RECIPE_THUMBS = {
  // Originales
  pasta: { c: ['#F0D49A', '#E8A838'], e: '🍝' },
  tortilla: { c: ['#F7E9A8', '#E8D56B'], e: '🥚' },
  caprese: { c: ['#D4E9D0', '#E8C8C0'], e: '🥗' },
  bocata: { c: ['#F1DDB4', '#D4A56B'], e: '🥪' },
  huevos: { c: ['#FFF0B8', '#F7D858'], e: '🍳' },
  tostada: { c: ['#DCE8B8', '#A8C08A'], e: '🥑' },
  risotto: { c: ['#F4D89C', '#D8A95C'], e: '🍚' },
  curry: { c: ['#F4B878', '#C25A3C'], e: '🍛' },
  salmon: { c: ['#F4C4AC', '#E09070'], e: '🐟' },
  paella: { c: ['#F0C870', '#C28040'], e: '🥘' },
  guaca: { c: ['#C5DCA0', '#8AAF68'], e: '🥑' },
  // Más opciones
  pizza: { c: ['#F4B574', '#C2502A'], e: '🍕' },
  burger: { c: ['#E8C595', '#A8702C'], e: '🍔' },
  taco: { c: ['#F4D078', '#D88040'], e: '🌮' },
  ramen: { c: ['#E8C8B0', '#B8704C'], e: '🍜' },
  sopa: { c: ['#F4D8A8', '#C8884C'], e: '🍲' },
  ensalada: { c: ['#C5DCA0', '#7CA868'], e: '🥗' },
  pollo: { c: ['#F4D894', '#C89048'], e: '🍗' },
  carne: { c: ['#E8A088', '#A0503C'], e: '🥩' },
  sushi: { c: ['#FCC4B8', '#E07058'], e: '🍣' },
  pancakes: { c: ['#FCDFA8', '#E8A858'], e: '🥞' },
  donut: { c: ['#F4C8DC', '#D88AB0'], e: '🍩' },
  cake: { c: ['#F8C8E0', '#D080A8'], e: '🍰' },
  fruta: { c: ['#F4B8B8', '#D87878'], e: '🍓' },
  smoothie: { c: ['#F4B8C8', '#D880A0'], e: '🥤' },
  cafe: { c: ['#D4A88C', '#8C5A38'], e: '☕' },
  helado: { c: ['#F8DCEC', '#E8B8C8'], e: '🍨' },
  picante: { c: ['#F4A088', '#C0503C'], e: '🌶️' },
  bento: { c: ['#FCE0A8', '#E8B048'], e: '🍱' },
};

export const RecipeThumb = ({ img, height }) => {
  const t = RECIPE_THUMBS[img] || { c: ['#E8E4D8', '#C8C4B8'], e: '🍽️' };
  return (
    <div style={{
      height, background: `linear-gradient(135deg, ${t.c[0]}, ${t.c[1]})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: height * 0.45, position: 'relative',
    }}>
      <span style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))' }}>{t.e}</span>
    </div>
  );
};
