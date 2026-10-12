import { t } from '../i18n/index.js';

// `label` es un getter: se traduce al idioma activo cada vez que se lee.
const cat = (id, color) => ({ id, color, get label() { return t(`domain.cat.${id}`); } });

export const LF_CATEGORIES = [
  cat('lacteo', '#E6D5A8'),
  cat('verdura', '#A8C9A0'),
  cat('fruta', '#E8B5B0'),
  cat('carne', '#D4A5A5'),
  cat('pescado', '#A8C4DB'),
  cat('pasta', '#E8CCA0'),
  cat('conserva', '#C4B8A5'),
  cat('salsa', '#E8B5A8'),
  cat('especia', '#D4B58A'),
  cat('bebida', '#B0C7D4'),
  cat('snack', '#E8BB8A'),
  cat('congelado', '#BFE3EA'),
];

export const catColor = (id) => LF_CATEGORIES.find((c) => c.id === id)?.color || '#E8E4D8';
export const catLabel = (id) => LF_CATEGORIES.find((c) => c.id === id)?.label || '';
