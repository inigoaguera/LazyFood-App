export const LF_CATEGORIES = [
  { id: 'lacteo',    label: 'Lácteos',         color: '#E6D5A8' },
  { id: 'verdura',   label: 'Verduras',        color: '#A8C9A0' },
  { id: 'fruta',     label: 'Frutas',          color: '#E8B5B0' },
  { id: 'carne',     label: 'Carne',           color: '#D4A5A5' },
  { id: 'pescado',   label: 'Pescado',         color: '#A8C4DB' },
  { id: 'pasta',     label: 'Pasta & cereales', color: '#E8CCA0' },
  { id: 'conserva',  label: 'Conservas',       color: '#C4B8A5' },
  { id: 'salsa',     label: 'Salsas',          color: '#E8B5A8' },
  { id: 'especia',   label: 'Especias',        color: '#D4B58A' },
  { id: 'bebida',    label: 'Bebidas',         color: '#B0C7D4' },
  { id: 'snack',     label: 'Snacks',          color: '#E8BB8A' },
  { id: 'congelado', label: 'Congelados',      color: '#BFE3EA' },
];

export const catColor = (id) => LF_CATEGORIES.find((c) => c.id === id)?.color || '#E8E4D8';
export const catLabel = (id) => LF_CATEGORIES.find((c) => c.id === id)?.label || '';
