// Datos de prueba para sembrar una casa rápidamente.
// Se llaman desde Profile → "Importar datos de prueba".

export const SAMPLE_ITEMS = [
  { name: 'Leche entera',     emoji: '🥛', cat: 'lacteo',   loc: 'fridge',   type: 'continuous', fill: 65, unit: 'L',  expires: 3 },
  { name: 'Huevos',            emoji: '🥚', cat: 'lacteo',   loc: 'fridge',   type: 'discrete',   qty: 8,  unit: 'uds', expires: 12 },
  { name: 'Yogur natural',     emoji: '🍦', cat: 'lacteo',   loc: 'fridge',   type: 'discrete',   qty: 4,  unit: 'uds', expires: 6 },
  { name: 'Tomates cherry',    emoji: '🍅', cat: 'verdura',  loc: 'fridge',   type: 'discrete',   qty: 12, unit: 'uds', expires: 4 },
  { name: 'Lechuga',           emoji: '🥬', cat: 'verdura',  loc: 'fridge',   type: 'discrete',   qty: 1,  unit: 'ud',  expires: 2 },
  { name: 'Zanahorias',        emoji: '🥕', cat: 'verdura',  loc: 'fridge',   type: 'discrete',   qty: 5,  unit: 'uds', expires: 9 },
  { name: 'Pechuga de pollo',  emoji: '🍗', cat: 'carne',    loc: 'fridge',   type: 'continuous', fill: 80, unit: 'kg', expires: 2 },
  { name: 'Salmón',            emoji: '🐟', cat: 'pescado',  loc: 'freezer',  type: 'continuous', fill: 100, unit: 'kg', expires: 30 },
  { name: 'Guisantes',         emoji: '🫛', cat: 'congelado', loc: 'freezer', type: 'continuous', fill: 45, unit: 'g',  expires: 60 },
  { name: 'Helado vainilla',   emoji: '🍨', cat: 'congelado', loc: 'freezer', type: 'continuous', fill: 30, unit: 'L',  expires: 120 },
  { name: 'Gambas',            emoji: '🦐', cat: 'pescado',  loc: 'freezer',  type: 'continuous', fill: 70, unit: 'g',  expires: 45 },
  { name: 'Pan de molde',      emoji: '🍞', cat: 'pasta',    loc: 'freezer',  type: 'continuous', fill: 90, unit: 'ud', expires: 30 },
  { name: 'Arroz basmati',     emoji: '🍚', cat: 'pasta',    loc: 'pantry',   type: 'continuous', fill: 55, unit: 'kg', expires: 180 },
  { name: 'Espaguetis',        emoji: '🍝', cat: 'pasta',    loc: 'pantry',   type: 'continuous', fill: 20, unit: 'g',  expires: 200 },
  { name: 'Aceite de oliva',   emoji: '🫒', cat: 'conserva', loc: 'pantry',   type: 'continuous', fill: 40, unit: 'L',  expires: 300 },
  { name: 'Garbanzos',         emoji: '🫘', cat: 'conserva', loc: 'pantry',   type: 'discrete',   qty: 3,  unit: 'latas', expires: 400 },
  { name: 'Atún en lata',      emoji: '🐟', cat: 'conserva', loc: 'pantry',   type: 'discrete',   qty: 5,  unit: 'latas', expires: 500 },
  { name: 'Café en grano',     emoji: '☕', cat: 'bebida',   loc: 'pantry',   type: 'continuous', fill: 75, unit: 'g',  expires: 90 },
  { name: 'Sal',               emoji: '🧂', cat: 'conserva', loc: 'pantry',   type: 'continuous', fill: 85, unit: 'kg', expires: 999 },
  { name: 'Cebollas',          emoji: '🧅', cat: 'verdura',  loc: 'pantry',   type: 'discrete',   qty: 4,  unit: 'uds', expires: 14 },
  { name: 'Manzanas',          emoji: '🍎', cat: 'fruta',    loc: 'fridge',   type: 'discrete',   qty: 6,  unit: 'uds', expires: 10 },
  { name: 'Plátanos',          emoji: '🍌', cat: 'fruta',    loc: 'pantry',   type: 'discrete',   qty: 3,  unit: 'uds', expires: 3 },
  { name: 'Queso rallado',     emoji: '🧀', cat: 'lacteo',   loc: 'fridge',   type: 'continuous', fill: 50, unit: 'g',  expires: 20 },
];

export const SAMPLE_RECIPES = [
  { name: 'Pasta de mamá',       time: 25, effort: 2, missing: 0, img: 'pasta', group: 'yours', author: 'tuya' },
  { name: 'Tortilla fácil',      time: 15, effort: 1, missing: 0, img: 'tortilla', group: 'yours', author: 'tuya' },
  { name: 'Ensalada caprese',    time: 8,  effort: 1, missing: 0, img: 'caprese',  group: 'effortless' },
  { name: 'Bocata atún & tomate', time: 5,  effort: 1, missing: 0, img: 'bocata',   group: 'effortless' },
  { name: 'Huevos revueltos',    time: 6,  effort: 1, missing: 0, img: 'huevos',   group: 'effortless' },
  { name: 'Tostada aguacate',    time: 7,  effort: 1, missing: 0, img: 'tostada',  group: 'effortless' },
  { name: 'Risotto de gambas',   time: 45, effort: 3, missing: 0, img: 'risotto',  group: 'chef' },
  { name: 'Pollo al curry thai', time: 55, effort: 3, missing: 0, img: 'curry',    group: 'chef' },
  { name: 'Salmón teriyaki',     time: 30, effort: 2, missing: 1, missingItem: 'Salsa soja', img: 'salmon', group: 'oneOff' },
  { name: 'Paella mixta',        time: 50, effort: 3, missing: 1, missingItem: 'Azafrán',    img: 'paella', group: 'oneOff' },
  { name: 'Guacamole',           time: 10, effort: 1, missing: 1, missingItem: 'Aguacate',   img: 'guaca',  group: 'oneOff' },
];

export const SAMPLE_SHOPPING = [
  { name: 'Mozzarella',      qty: '125 g',  cat: 'lacteo',   checked: 0, auto: 1 },
  { name: 'Salsa de soja',   qty: '1 bote', cat: 'conserva', checked: 0, auto: 1 },
  { name: 'Aguacate',        qty: '2 uds',  cat: 'fruta',    checked: 0, auto: 1 },
  { name: 'Pan integral',    qty: '1 ud',   cat: 'pasta',    checked: 1, auto: 0 },
  { name: 'Papel de cocina', qty: '1 pack', cat: null,       checked: 0, auto: 0 },
  { name: 'Leche de avena',  qty: '1 L',    cat: 'bebida',   checked: 0, auto: 0 },
];

export const SAMPLE_RECIPE_DETAILS = [
  {
    matchName: 'Ensalada caprese',
    name: 'Ensalada caprese',
    time: 8, effort: 1, servings: 2,
    img: 'caprese',
    desc: 'El clásico italiano. Tres ingredientes, cero excusas.',
    ingredients: [
      { name: 'Tomates cherry', qty: '6 uds', have: true },
      { name: 'Mozzarella',     qty: '125 g', have: false, note: 'Te la pedimos la próxima' },
      { name: 'Albahaca fresca', qty: 'un puñado', have: false, note: 'Opcional' },
      { name: 'Aceite de oliva', qty: '2 cdas', have: true },
      { name: 'Sal',            qty: 'al gusto', have: true },
    ],
    steps: [
      'Lava y corta los tomates por la mitad.',
      'Trocea la mozzarella en cubos o rodajas según prefieras.',
      'Mezcla todo en un bol, añade albahaca y aliña con aceite y sal.',
      'Deja reposar 5 minutos antes de servir.',
    ],
  },
];

// Genera gastos realistas repartidos por las últimas 4 semanas, anclados a HOY.
function buildSampleExpenses() {
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const day = (deltaDays) => {
    const d = new Date(now.getTime() - deltaDays * dayMs);
    // Fecha LOCAL, no UTC, para que coincida con la zona horaria del usuario.
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };
  // Pequeño helper para abreviar la creación de items
  const item = (name, emoji, cat, price, qty = 1, opts = {}) => {
    const type = opts.type || 'discrete';
    const defaultUnit = type === 'continuous' ? 'L' : 'uds';
    return {
      name, emoji, category: cat, qty, price,
      unit: opts.unit || defaultUnit,
      type,
      shape: type === 'continuous' ? (opts.shape || 'bottle') : null,
      loc: opts.loc,
    };
  };

  return [
    {
      date: day(28), amount: 67.45, cat: 'super', store: 'Mercadona',
      savedOnDiscounts: 4.20,
      items: [
        item('Leche entera 1L x6', '🥛', 'lacteo', 6.30),
        item('Tomates pera', '🍅', 'verdura', 3.40, 1, { unit: 'kg', type: 'continuous' }),
        item('Pechuga pollo 700g', '🍗', 'carne', 7.90, 1, { unit: 'kg', type: 'continuous' }),
        item('Pasta integral', '🍝', 'pasta', 2.10, 2),
        item('Yogures naturales x12', '🍦', 'lacteo', 3.85),
        item('Atún en aceite x6', '🐟', 'conserva', 6.20),
        item('Aceite oliva 1L', '🫒', 'conserva', 8.95, 1, { unit: 'L', type: 'continuous' }),
        item('Detergente', '🧺', 'snack', 12.50),
      ],
    },
    {
      date: day(21), amount: 22.15, cat: 'super', store: 'Lidl',
      savedOnDiscounts: 1.50,
      items: [
        item('Plátanos', '🍌', 'fruta', 1.80, 1, { unit: 'kg' }),
        item('Manzanas Fuji', '🍎', 'fruta', 2.40, 1, { unit: 'kg' }),
        item('Pan integral', '🍞', 'pasta', 1.20),
        item('Queso de cabra', '🧀', 'lacteo', 4.95),
        item('Salmón fresco 400g', '🐟', 'pescado', 8.40, 1, { unit: 'g', type: 'continuous' }),
        item('Cerveza pack 6', '🍺', 'bebida', 3.40),
      ],
    },
    {
      date: day(14), amount: 49.80, cat: 'super', store: 'Mercadona',
      savedOnDiscounts: 2.10,
      items: [
        item('Verduras frescas mix', '🥬', 'verdura', 8.20),
        item('Huevos camperos x12', '🥚', 'lacteo', 3.40),
        item('Pollo entero', '🍗', 'carne', 9.50, 1, { unit: 'kg', type: 'continuous' }),
        item('Arroz basmati 1kg', '🍚', 'pasta', 2.20, 1, { unit: 'kg', type: 'continuous', shape: 'sack' }),
        item('Café molido 250g', '☕', 'bebida', 4.90, 1, { unit: 'g', type: 'continuous', shape: 'jar' }),
        item('Helado vainilla 1L', '🍨', 'congelado', 4.50, 1, { unit: 'L', type: 'continuous' }),
        item('Tortillas trigo x10', '🌮', 'pasta', 2.80),
        item('Chocolate negro', '🍫', 'snack', 3.10, 2),
        item('Limones', '🍋', 'fruta', 1.90),
        item('Aceitunas', '🫒', 'conserva', 2.30),
      ],
    },
    {
      date: day(7), amount: 14.20, cat: 'super', store: 'Carrefour',
      savedOnDiscounts: 0,
      items: [
        item('Pizza congelada x2', '🍕', 'congelado', 5.40),
        item('Coca-Cola 2L', '🥤', 'bebida', 3.40, 2, { unit: 'L', type: 'continuous' }),
        item('Patatas fritas', '🍟', 'snack', 2.20, 2),
      ],
    },
    {
      date: day(3), amount: 31.90, cat: 'super', store: 'Mercadona',
      savedOnDiscounts: 1.80,
      items: [
        item('Verduras de temporada', '🥦', 'verdura', 6.50),
        item('Salmón fresco 500g', '🐟', 'pescado', 9.80, 1, { unit: 'g', type: 'continuous' }),
        item('Pasta de espárragos', '🍝', 'pasta', 3.20),
        item('Queso parmesano', '🧀', 'lacteo', 5.40),
        item('Vino blanco', '🍷', 'bebida', 7.00, 1, { unit: 'L', type: 'continuous' }),
      ],
    },
    {
      date: day(1), amount: 8.40, cat: 'super', store: 'OpenCor',
      savedOnDiscounts: 0,
      items: [
        item('Leche desnatada', '🥛', 'lacteo', 1.80, 1, { unit: 'L', type: 'continuous' }),
        item('Pan barra', '🥖', 'pasta', 1.10),
        item('Café molido', '☕', 'bebida', 3.50, 1, { unit: 'g', type: 'continuous', shape: 'jar' }),
        item('Chicles', '🍬', 'snack', 1.00, 2),
      ],
    },
  ];
}

// Convierte items con `expires` (días) en items con `expiresAt` (timestamp absoluto).
// Si el item ya tiene expiresAt, se respeta. Si no tiene expires ni expiresAt, queda null.
function withExpiresAt(items) {
  const now = Date.now();
  return items.map((it) => {
    const out = { ...it };
    if (out.expiresAt == null && out.expires != null && out.expires > 0) {
      out.expiresAt = now + Number(out.expires) * 86400000;
    }
    delete out.expires; // legacy
    return out;
  });
}

export function buildSamplePayload() {
  return {
    items: withExpiresAt(SAMPLE_ITEMS),
    recipes: SAMPLE_RECIPES,
    shopping: SAMPLE_SHOPPING,
    expenses: buildSampleExpenses(),
    recipeDetails: SAMPLE_RECIPE_DETAILS,
    menuPlan: [],
  };
}
