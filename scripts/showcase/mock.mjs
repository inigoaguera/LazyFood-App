// Backend simulado para grabar el showcase: imita el Worker (rutas y formato
// de filas) con un almacén en memoria y respuestas de IA preparadas.
// El vídeo enseña la app en inglés, así que los datos son los de seed.en.js.
import { SAMPLE_ITEMS, SAMPLE_RECIPES, SAMPLE_SHOPPING, SAMPLE_RECIPE_DETAILS, SAMPLE_EXPENSE_NAMES } from '../../src/data/seed.en.js';
import { buildSampleExpenses } from '../../src/data/seed.es.js';

// La app se arranca con VITE_API_PROXY_URL=API_BASE (mismo origen, sin CORS) y
// Playwright intercepta esas rutas: nada sale a la red.
export const APP_URL = process.env.SHOWCASE_APP_URL || 'http://localhost:5173/';
export const API_BASE = new URL('__mock', APP_URL).href;
export const HOUSEHOLD_ID = 'casa-1';
const HOUSEHOLD = { id: HOUSEHOLD_ID, name: 'Lazy Home', color: '#4A7C3A', budget: 300 };
const DAY = 86400000;

let seq = 0;
const uid = (p) => `${p}-${++seq}`;
const isoDay = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export function buildStore() {
  const now = Date.now();
  const items = SAMPLE_ITEMS.map(({ expires, ...it }) => ({
    id: uid('it'), ...it,
    qty: it.qty ?? null, fill: it.fill ?? null,
    expiresAt: expires ? now + expires * DAY - 3600000 : null,
    frozenAt: it.loc === 'freezer' ? now - 5 * DAY : null,
    openedAt: null, price: null,
    shape: it.type === 'continuous' ? (it.unit === 'L' ? 'bottle' : 'jar') : null,
    updated_at: now,
  }));
  const recipes = SAMPLE_RECIPES.map((r) => ({ id: uid('rc'), ...r, missingItem: r.missingItem ?? null, updated_at: now }));
  const shopping = SAMPLE_SHOPPING.map((s) => ({ id: uid('sh'), count: 1, ...s, updated_at: now }));

  // Tiendas ficticias en vez de las de los datos de prueba, y tres compras más
  // este mes para que el gráfico de gastos tenga algo que enseñar.
  const STORE = { Mercadona: 'Green Market', Lidl: 'Saver Market', Carrefour: 'SunMart', OpenCor: 'Corner Shop' };
  const L = (name, emoji, category, price, unit = 'uds') => ({ name, emoji, category, price, qty: 1, unit });
  const extra = [
    { date: isoDay(now - 12 * DAY), amount: 64.2, cat: 'super', store: 'SunMart', savedOnDiscounts: 3.4, items: [
      L('Chicken breast', '🍗', 'carne', 8.9, 'kg'), L('Minced beef', '🥩', 'carne', 6.4), L('Hake', '🐟', 'pescado', 9.8),
      L('Yoghurts x8', '🍦', 'lacteo', 3.2), L('Manchego cheese', '🧀', 'lacteo', 7.9), L('Rice', '🍚', 'pasta', 2.1),
      L('Mixed fruit', '🍎', 'fruta', 7.6), L('Vegetables', '🥦', 'verdura', 8.3), L('Juice', '🧃', 'bebida', 3.5), L('Biscuits', '🍪', 'snack', 6.5)] },
    { date: isoDay(now - 9 * DAY), amount: 12.3, cat: 'super', store: "Lola's Greengrocer", savedOnDiscounts: 0, items: [
      L('Tomatoes', '🍅', 'verdura', 3.1, 'kg'), L('Bananas', '🍌', 'fruta', 2.4), L('Oranges', '🍊', 'fruta', 3.9), L('Lettuce', '🥬', 'verdura', 1.2), L('Strawberries', '🍓', 'fruta', 1.7)] },
    { date: isoDay(now - 5 * DAY), amount: 38.6, cat: 'super', store: 'Green Market', savedOnDiscounts: 1.9, items: [
      L('Salmon', '🐟', 'pescado', 9.4), L('Milk x6', '🥛', 'lacteo', 6.3), L('Eggs x12', '🥚', 'lacteo', 3.4), L('Pasta', '🍝', 'pasta', 2.6),
      L('Olive oil', '🫒', 'conserva', 8.9), L('Beer', '🍺', 'bebida', 4.2), L('Potatoes', '🥔', 'verdura', 3.8)] },
  ];
  const expenses = [...buildSampleExpenses(SAMPLE_EXPENSE_NAMES), ...extra].map((e) => ({
    id: uid('ex'), date: e.date, amount: e.amount, cat: e.cat, store: STORE[e.store] || e.store,
    savedOnDiscounts: e.savedOnDiscounts, photoUrl: null, updated_at: now,
    // Desglose guardado tal y como lo deja el escáner (util/expenseLines.js).
    items: e.items.map((it, i) => ({ id: `l${seq}-${i}`, name: it.name, emoji: it.emoji, cat: it.category, qty: it.qty, unit: it.unit, price: it.price })),
  }));

  const recipeDetails = [
    ...SAMPLE_RECIPE_DETAILS,
    {
      matchName: "Mum's pasta", name: "Mum's pasta", time: 25, effort: 2, servings: 4, img: 'pasta',
      desc: 'The Sunday classic. Tomato, garlic and patience: it tastes like home.',
      ingredients: [
        { name: 'Spaghetti', qty: '400 g', have: true },
        { name: 'Cherry tomatoes', qty: '12 pcs', have: true },
        { name: 'Olive oil', qty: '3 tbsp', have: true },
        { name: 'Onions', qty: '1 pc', have: true },
        { name: 'Grated cheese', qty: '60 g', have: true },
        { name: 'Fresh basil', qty: 'a handful', have: false, note: 'Optional' },
      ],
      steps: [
        'Bring salted water to the boil and cook the pasta al dente.',
        'Gently fry the chopped onion in oil for 8 minutes.',
        'Add the halved tomatoes and let them break down for 10 minutes.',
        'Toss the pasta with the sauce and a splash of cooking water.',
        'Serve topped with grated cheese.',
      ],
      tools: ['Pot', 'Frying pan'],
    },
    {
      matchName: 'Easy Spanish omelette', name: 'Easy Spanish omelette', time: 15, effort: 1, servings: 2, img: 'tortilla',
      desc: 'Soft in the middle, ready in fifteen minutes.',
      ingredients: [
        { name: 'Eggs', qty: '4 pcs', have: true },
        { name: 'Onions', qty: '1 pc', have: true },
        { name: 'Olive oil', qty: '2 tbsp', have: true },
        { name: 'Salt', qty: 'to taste', have: true },
      ],
      steps: ['Soften the onion.', 'Beat the eggs with salt.', 'Set over a medium heat and flip.'],
      tools: ['Frying pan'],
    },
  ].map((d) => ({ id: uid('rd'), ...d, updated_at: now }));

  return { items, recipes, shopping, expenses, recipeDetails, categories: [], menuPlan: [] };
}

const RES_KEY = {
  items: 'items', recipes: 'recipes', shopping: 'shopping', expenses: 'expenses',
  'recipe-details': 'recipeDetails', categories: 'categories',
};

const me = (prefs) => ({
  id: 'user-1', email: 'laura@lazyfood.app', name: 'Laura', avatar: '🥑', prefs,
  households: [{ ...HOUSEHOLD, onboarded: true, role: 'owner' }],
});

// ─── Respuestas de IA ─────────────────────────────────────────────────
const idea = (name, time, img, uses, why, missingItem = null) => ({
  name, time, img, uses, why, missingItem,
  tools: ['Frying pan'],
  steps: ['Prep the ingredients.', 'Cook over a medium heat.', 'Plate up and enjoy.'],
});

const AI = {
  hub: () => ({
    effortless: [
      idea('Tomato & cheese toasts', 6, 'tostada', ['Sliced bread', 'Cherry tomatoes', 'Grated cheese'], 'Your tomatoes expire soon'),
      idea('Apple & cinnamon yoghurt', 3, 'fruta', ['Natural yoghurt', 'Apples'], 'A 3-minute snack'),
      idea('Fried eggs with salad', 8, 'huevos', ['Eggs', 'Lettuce', 'Cherry tomatoes'], 'Uses up the lettuce'),
      idea('Banana smoothie', 4, 'smoothie', ['Bananas', 'Whole milk'], 'Very ripe bananas'),
      idea('Chickpea salad', 7, 'ensalada', ['Chickpeas', 'Cherry tomatoes', 'Onions'], 'No cooking needed'),
    ],
    chef: [
      idea('Garlic chicken with rice', 40, 'pollo', ['Chicken breast', 'Basmati rice', 'Olive oil'], 'The chicken expires in 2 days'),
      idea('Pea risotto', 35, 'risotto', ['Basmati rice', 'Peas', 'Grated cheese'], 'Creamy, straight from the pantry'),
      idea('Baked salmon with veg', 30, 'salmon', ['Salmon', 'Carrots', 'Onions'], 'A full dinner'),
      idea('Homemade ramen', 45, 'ramen', ['Chicken breast', 'Eggs', 'Carrots'], 'A Sunday project'),
      idea('Prawn curry', 30, 'curry', ['Prawns', 'Basmati rice', 'Onions'], 'Something exotic'),
    ],
    oneOff: [
      idea('Chicken tacos', 25, 'taco', ['Chicken breast', 'Lettuce', 'Cherry tomatoes'], 'Just one thing missing', 'Wheat tortillas'),
      idea('Homemade pizza', 35, 'pizza', ['Cherry tomatoes', 'Grated cheese'], 'Pizza Friday', 'Pizza dough'),
      idea('Sushi bowl', 25, 'sushi', ['Salmon', 'Basmati rice'], 'Like at your favourite place', 'Nori'),
      idea('American pancakes', 20, 'pancakes', ['Eggs', 'Whole milk'], 'Weekend breakfast', 'Flour'),
      idea('Vegetable soup', 30, 'sopa', ['Carrots', 'Onions', 'Peas'], 'Proper comfort food', 'Leek'),
    ],
  }),
  chat: () => ({
    intro: "I've got just the thing! With what's in your fridge, here are three quick, comforting ideas:",
    recipes: [
      { name: 'Creamy tomato pasta', time: 20, uses: ['Spaghetti', 'Cherry tomatoes', 'Grated cheese'],
        why: 'Uses the tomatoes that expire in 4 days', tools: ['Pot', 'Frying pan'],
        steps: ['Cook the pasta.', 'Sauté the tomatoes in oil.', 'Stir in the cheese and a splash of pasta water.'] },
      { name: 'Fried eggs with veg', time: 15, uses: ['Eggs', 'Onions', 'Carrots'],
        why: "Quick, and made with what you've got", tools: ['Frying pan'],
        steps: ['Soften the onion and carrot.', 'Crack in the eggs.', 'Break them up and serve.'] },
      { name: 'Chicken fried rice', time: 25, uses: ['Basmati rice', 'Chicken breast', 'Peas'],
        why: 'Your chicken expires the day after tomorrow', tools: ['Wok'],
        steps: ['Cook the rice.', 'Brown the chicken strips.', 'Stir-fry everything with the peas.'] },
    ],
  }),
  // Lo mismo que pone el ticket de receipt.html.
  receipt: () => ({
    store: 'Green Market', date: isoDay(Date.now()), total: 22.85, savedOnDiscounts: 1.2,
    items: [
      { name: 'Avocados', qty: 2, price: 2.4, category: 'fruta', loc: 'fridge', type: 'discrete', unit: 'uds', shape: null, expiresInDays: 5, emoji: '🥑' },
      { name: 'Mozzarella', qty: 1, price: 1.35, category: 'lacteo', loc: 'fridge', type: 'discrete', unit: 'ud', shape: null, expiresInDays: 10, emoji: '🧀' },
      { name: 'Strawberries', qty: 1, price: 2.95, category: 'fruta', loc: 'fridge', type: 'discrete', unit: 'ud', shape: null, expiresInDays: 4, emoji: '🍓' },
      { name: 'Red peppers', qty: 3, price: 2.1, category: 'verdura', loc: 'fridge', type: 'discrete', unit: 'uds', shape: null, expiresInDays: 8, emoji: '🫑' },
      { name: 'Soy sauce', qty: 1, price: 1.65, category: 'salsa', loc: 'pantry', type: 'continuous', unit: 'L', shape: 'bottle', expiresInDays: 365, emoji: '🍶' },
      { name: 'Wholemeal bread', qty: 1, price: 1.4, category: 'pasta', loc: 'pantry', type: 'discrete', unit: 'ud', shape: null, expiresInDays: 6, emoji: '🍞' },
      { name: 'Oat milk', qty: 2, price: 3.0, category: 'bebida', loc: 'pantry', type: 'continuous', unit: 'L', shape: 'bottle', expiresInDays: 60, emoji: '🥛' },
      { name: 'Margherita pizza', qty: 1, price: 3.25, category: 'congelado', loc: 'freezer', type: 'discrete', unit: 'ud', shape: null, expiresInDays: 120, emoji: '🍕' },
      { name: 'Dark chocolate', qty: 2, price: 3.4, category: 'snack', loc: 'pantry', type: 'discrete', unit: 'uds', shape: null, expiresInDays: 200, emoji: '🍫' },
      { name: 'Lemons', qty: 1, price: 1.35, category: 'fruta', loc: 'fridge', type: 'discrete', unit: 'ud', shape: null, expiresInDays: 20, emoji: '🍋' },
    ],
  }),
  replacement: () => idea('Courgette soup', 25, 'sopa', ['Onions', 'Grated cheese'], 'Light and smooth'),
  // Para "Mum's pasta" de 4 a 6 raciones (ver recipeDetails arriba).
  scale: () => ({ ingredients: [
    { index: 0, qty: '600 g' }, { index: 1, qty: '18 pcs' }, { index: 2, qty: '4 tbsp' },
    { index: 3, qty: '2 pcs' }, { index: 4, qty: '90 g' }, { index: 5, qty: 'a big handful' },
  ] }),
  autoplan: (schema) => {
    const slots = schema?.properties?.assignments?.items?.properties?.slot?.enum || [];
    const ids = schema?.properties?.assignments?.items?.properties?.recipeId?.enum || [];
    return { assignments: slots.map((slot, i) => ({ slot, recipeId: ids[(i * 3 + 1) % ids.length] })) };
  },
};

// Cada llamada se reconoce por el esquema de respuesta que manda (aiSchemas.js).
function classifyAi(payload) {
  const schema = payload?.generationConfig?.responseSchema;
  const props = schema?.properties || {};
  if (props.assignments) return ['autoplan', schema];
  if (props.effortless) return ['hub', schema];
  if (props.store || 'total' in props) return ['receipt', schema];
  if (props.ingredients) return ['scale', schema];
  if (props.img && props.steps) return ['replacement', schema];
  return ['chat', schema];
}

const geminiWrap = (obj) => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] });

export async function installMock(context, { store, prefs = { palette: 'huerto', font: 'playful', lang: 'en' }, aiDelay = {} } = {}) {
  const state = { prefs: { ...prefs }, store };
  const basePath = new URL(API_BASE).pathname;
  await context.route(`${API_BASE}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.slice(basePath.length).replace(/\/+$/, '');
    const m = req.method();
    const body = (() => { try { return req.postDataJSON(); } catch { return null; } })();
    const reply = (status, data) => route.fulfill({ status, contentType: 'application/json', body: data == null ? '' : JSON.stringify(data) });
    const now = Date.now();

    if (path === '/me' && m === 'GET') return reply(200, me(state.prefs));
    if (path === '/me' && m === 'PATCH') { if (body?.prefs) Object.assign(state.prefs, body.prefs); return reply(200, { ok: true }); }
    if (path === '/ai' && m === 'POST') {
      const [kind, schema] = classifyAi(body?.payload);
      await new Promise((r) => setTimeout(r, aiDelay[kind] ?? 900));
      return reply(200, geminiWrap(AI[kind](schema)));
    }

    const hm = path.match(/^\/households\/([\w-]+)(\/.*)?$/);
    if (hm) {
      const sub = hm[2] || '';
      if (sub === '' && m === 'GET') return reply(200, { ...HOUSEHOLD, members: [
        { id: 'user-1', userId: 'user-1', name: 'Laura', email: 'laura@lazyfood.app', role: 'owner', avatar: '🥑' },
        { id: 'user-2', userId: 'user-2', name: 'Dani', email: 'dani@lazyfood.app', role: 'member', avatar: '🍋' },
      ] });
      if (sub === '' && m === 'PATCH') return reply(200, { ok: true });
      if (sub === '/menu-plan' && m === 'GET') return reply(200, { rows: state.store.menuPlan.map((r) => ({ ...r, deleted_at: null })), serverTime: now });
      if (sub === '/menu-plan' && m === 'POST') {
        const i = state.store.menuPlan.findIndex((r) => r.slot === body.slot);
        if (i >= 0) state.store.menuPlan.splice(i, 1);
        if (body.recipeId) state.store.menuPlan.push({ slot: body.slot, recipeId: body.recipeId, updated_at: now });
        return reply(200, { ok: true, updated_at: now });
      }
      const rm = sub.match(/^\/([\w-]+)(?:\/([\w-]+))?$/);
      if (rm && RES_KEY[rm[1]]) {
        const table = state.store[RES_KEY[rm[1]]];
        const id = rm[2];
        if (!id && m === 'GET') {
          const since = Number(url.searchParams.get('since')) || 0;
          return reply(200, { rows: since > 0 ? table.filter((r) => r.updated_at > since) : table, serverTime: now });
        }
        if (!id && m === 'POST') {
          const row = { id: body.id || uid('new'), ...body, updated_at: now };
          table.push(row);
          return reply(201, row);
        }
        if (id && m === 'PATCH') {
          const row = table.find((r) => r.id === id);
          if (row) Object.assign(row, body, { updated_at: now });
          return reply(200, { ok: true, updated_at: now });
        }
        if (id && m === 'DELETE') {
          const i = table.findIndex((r) => r.id === id);
          if (i >= 0) table.splice(i, 1);
          return route.fulfill({ status: 204, body: '' });
        }
      }
    }
    console.warn('[mock] sin ruta', m, path);
    return reply(404, { error: { code: 'NOT_FOUND', message: `${m} ${path}` } });
  });
  return state;
}

// Sesión ya iniciada: el JWT se rehidrata desde localStorage al arrancar.
export async function seedSession(context) {
  await context.addInitScript(() => {
    try { localStorage.setItem('lf_jwt', 'demo.jwt.token'); } catch { /* sin storage */ }
  });
}
