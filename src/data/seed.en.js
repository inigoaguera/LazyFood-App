// English sample data — same structure and numbers as seed.es.js.
// Only human-readable text is translated (names, free-text quantities, notes, steps).
// Stored keys (cat, loc, type, unit, img, group, author) stay identical so the app
// can translate them at display time.

export const SAMPLE_ITEMS = [
  { name: 'Whole milk',        emoji: '🥛', cat: 'lacteo',   loc: 'fridge',   type: 'continuous', fill: 65, unit: 'L',  expires: 3 },
  { name: 'Eggs',              emoji: '🥚', cat: 'lacteo',   loc: 'fridge',   type: 'discrete',   qty: 8,  unit: 'uds', expires: 12 },
  { name: 'Natural yoghurt',   emoji: '🍦', cat: 'lacteo',   loc: 'fridge',   type: 'discrete',   qty: 4,  unit: 'uds', expires: 6 },
  { name: 'Cherry tomatoes',   emoji: '🍅', cat: 'verdura',  loc: 'fridge',   type: 'discrete',   qty: 12, unit: 'uds', expires: 4 },
  { name: 'Lettuce',           emoji: '🥬', cat: 'verdura',  loc: 'fridge',   type: 'discrete',   qty: 1,  unit: 'ud',  expires: 2 },
  { name: 'Carrots',           emoji: '🥕', cat: 'verdura',  loc: 'fridge',   type: 'discrete',   qty: 5,  unit: 'uds', expires: 9 },
  { name: 'Chicken breast',    emoji: '🍗', cat: 'carne',    loc: 'fridge',   type: 'continuous', fill: 80, unit: 'kg', expires: 2 },
  { name: 'Salmon',            emoji: '🐟', cat: 'pescado',  loc: 'freezer',  type: 'continuous', fill: 100, unit: 'kg', expires: 30 },
  { name: 'Peas',              emoji: '🫛', cat: 'congelado', loc: 'freezer', type: 'continuous', fill: 45, unit: 'g',  expires: 60 },
  { name: 'Vanilla ice cream', emoji: '🍨', cat: 'congelado', loc: 'freezer', type: 'continuous', fill: 30, unit: 'L',  expires: 120 },
  { name: 'Prawns',            emoji: '🦐', cat: 'pescado',  loc: 'freezer',  type: 'continuous', fill: 70, unit: 'g',  expires: 45 },
  { name: 'Sliced bread',      emoji: '🍞', cat: 'pasta',    loc: 'freezer',  type: 'continuous', fill: 90, unit: 'ud', expires: 30 },
  { name: 'Basmati rice',      emoji: '🍚', cat: 'pasta',    loc: 'pantry',   type: 'continuous', fill: 55, unit: 'kg', expires: 180 },
  { name: 'Spaghetti',         emoji: '🍝', cat: 'pasta',    loc: 'pantry',   type: 'continuous', fill: 20, unit: 'g',  expires: 200 },
  { name: 'Olive oil',         emoji: '🫒', cat: 'conserva', loc: 'pantry',   type: 'continuous', fill: 40, unit: 'L',  expires: 300 },
  { name: 'Chickpeas',         emoji: '🫘', cat: 'conserva', loc: 'pantry',   type: 'discrete',   qty: 3,  unit: 'latas', expires: 400 },
  { name: 'Tinned tuna',       emoji: '🐟', cat: 'conserva', loc: 'pantry',   type: 'discrete',   qty: 5,  unit: 'latas', expires: 500 },
  { name: 'Coffee beans',      emoji: '☕', cat: 'bebida',   loc: 'pantry',   type: 'continuous', fill: 75, unit: 'g',  expires: 90 },
  { name: 'Salt',              emoji: '🧂', cat: 'conserva', loc: 'pantry',   type: 'continuous', fill: 85, unit: 'kg', expires: 999 },
  { name: 'Onions',            emoji: '🧅', cat: 'verdura',  loc: 'pantry',   type: 'discrete',   qty: 4,  unit: 'uds', expires: 14 },
  { name: 'Apples',            emoji: '🍎', cat: 'fruta',    loc: 'fridge',   type: 'discrete',   qty: 6,  unit: 'uds', expires: 10 },
  { name: 'Bananas',           emoji: '🍌', cat: 'fruta',    loc: 'pantry',   type: 'discrete',   qty: 3,  unit: 'uds', expires: 3 },
  { name: 'Grated cheese',     emoji: '🧀', cat: 'lacteo',   loc: 'fridge',   type: 'continuous', fill: 50, unit: 'g',  expires: 20 },
];

export const SAMPLE_RECIPES = [
  { name: "Mum's pasta",           time: 25, effort: 2, missing: 0, img: 'pasta', group: 'yours', author: 'tuya' },
  { name: 'Easy Spanish omelette', time: 15, effort: 1, missing: 0, img: 'tortilla', group: 'yours', author: 'tuya' },
  { name: 'Caprese salad',         time: 8,  effort: 1, missing: 0, img: 'caprese',  group: 'effortless' },
  { name: 'Tuna & tomato sarnie',  time: 5,  effort: 1, missing: 0, img: 'bocata',   group: 'effortless' },
  { name: 'Scrambled eggs',        time: 6,  effort: 1, missing: 0, img: 'huevos',   group: 'effortless' },
  { name: 'Avocado toast',         time: 7,  effort: 1, missing: 0, img: 'tostada',  group: 'effortless' },
  { name: 'Prawn risotto',         time: 45, effort: 3, missing: 0, img: 'risotto',  group: 'chef' },
  { name: 'Thai chicken curry',    time: 55, effort: 3, missing: 0, img: 'curry',    group: 'chef' },
  { name: 'Teriyaki salmon',       time: 30, effort: 2, missing: 1, missingItem: 'Soy sauce', img: 'salmon', group: 'oneOff' },
  { name: 'Mixed paella',          time: 50, effort: 3, missing: 1, missingItem: 'Saffron',   img: 'paella', group: 'oneOff' },
  { name: 'Guacamole',             time: 10, effort: 1, missing: 1, missingItem: 'Avocado',   img: 'guaca',  group: 'oneOff' },
];

export const SAMPLE_SHOPPING = [
  { name: 'Mozzarella',      qty: '125 g',  cat: 'lacteo',   checked: 0, auto: 1 },
  { name: 'Soy sauce',       qty: '1 jar',  cat: 'conserva', checked: 0, auto: 1 },
  { name: 'Avocado',         qty: '2 pcs',  cat: 'fruta',    checked: 0, auto: 1 },
  { name: 'Wholemeal bread', qty: '1 pc',   cat: 'pasta',    checked: 1, auto: 0 },
  { name: 'Kitchen roll',    qty: '1 pack', cat: null,       checked: 0, auto: 0 },
  { name: 'Oat milk',        qty: '1 L',    cat: 'bebida',   checked: 0, auto: 0 },
];

export const SAMPLE_RECIPE_DETAILS = [
  {
    matchName: 'Caprese salad',
    name: 'Caprese salad',
    time: 8, effort: 1, servings: 2,
    img: 'caprese',
    desc: 'The Italian classic. Three ingredients, zero excuses.',
    ingredients: [
      { name: 'Cherry tomatoes', qty: '6 pcs', have: true },
      { name: 'Mozzarella',      qty: '125 g', have: false, note: "We'll add it to your list for next time" },
      { name: 'Fresh basil',     qty: 'a handful', have: false, note: 'Optional' },
      { name: 'Olive oil',       qty: '2 tbsp', have: true },
      { name: 'Salt',            qty: 'to taste', have: true },
    ],
    steps: [
      'Wash the tomatoes and cut them in half.',
      'Slice the mozzarella into cubes or rounds, whichever you prefer.',
      'Mix everything in a bowl, add the basil and dress with oil and salt.',
      'Leave to rest for 5 minutes before serving.',
    ],
  },
];

// Translated shopping-line names for the expenses builder in seed.es.js
// (buildSampleExpenses(names)): { Spanish name → English name }. Amounts, dates,
// categories, units and stores are shared with the Spanish data set.
export const SAMPLE_EXPENSE_NAMES = {
  // Mercadona (28 days ago)
  'Leche entera 1L x6':    'Whole milk 1L x6',
  'Tomates pera':          'Plum tomatoes',
  'Pechuga pollo 700g':    'Chicken breast 700g',
  'Pasta integral':        'Wholewheat pasta',
  'Yogures naturales x12': 'Natural yoghurts x12',
  'Atún en aceite x6':     'Tuna in oil x6',
  'Aceite oliva 1L':       'Olive oil 1L',
  'Detergente':            'Laundry detergent',
  // Lidl (21 days ago)
  'Plátanos':              'Bananas',
  'Manzanas Fuji':         'Fuji apples',
  'Pan integral':          'Wholemeal bread',
  'Queso de cabra':        "Goat's cheese",
  'Salmón fresco 400g':    'Fresh salmon 400g',
  'Cerveza pack 6':        'Beer 6-pack',
  // Mercadona (14 days ago)
  'Verduras frescas mix':  'Mixed fresh veg',
  'Huevos camperos x12':   'Free-range eggs x12',
  'Pollo entero':          'Whole chicken',
  'Arroz basmati 1kg':     'Basmati rice 1kg',
  'Café molido 250g':      'Ground coffee 250g',
  'Helado vainilla 1L':    'Vanilla ice cream 1L',
  'Tortillas trigo x10':   'Wheat tortillas x10',
  'Chocolate negro':       'Dark chocolate',
  'Limones':               'Lemons',
  'Aceitunas':             'Olives',
  // Carrefour (7 days ago)
  'Pizza congelada x2':    'Frozen pizza x2',
  'Coca-Cola 2L':          'Coca-Cola 2L',
  'Patatas fritas':        'Crisps',
  // Mercadona (3 days ago)
  'Verduras de temporada': 'Seasonal veg',
  'Salmón fresco 500g':    'Fresh salmon 500g',
  'Pasta de espárragos':   'Asparagus pasta',
  'Queso parmesano':       'Parmesan',
  'Vino blanco':           'White wine',
  // OpenCor (yesterday)
  'Leche desnatada':       'Skimmed milk',
  'Pan barra':             'Baguette',
  'Café molido':           'Ground coffee',
  'Chicles':               'Chewing gum',
};
