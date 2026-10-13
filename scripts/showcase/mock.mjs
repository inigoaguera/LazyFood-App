// Backend simulado para grabar el showcase: imita el Worker (rutas y formato
// de filas) con un almacén en memoria y respuestas de IA preparadas.
import { SAMPLE_ITEMS, SAMPLE_RECIPES, SAMPLE_SHOPPING, SAMPLE_RECIPE_DETAILS, buildSampleExpenses } from '../../src/data/seed.es.js';

// La app se arranca con VITE_API_PROXY_URL=API_BASE (mismo origen, sin CORS) y
// Playwright intercepta esas rutas: nada sale a la red.
export const APP_URL = process.env.SHOWCASE_APP_URL || 'http://localhost:5173/';
export const API_BASE = new URL('__mock', APP_URL).href;
const HID = 'casa-1';
const DAY = 86400000;

let seq = 0;
const uid = (p) => `${p}-${++seq}`;

export function buildStore() {
  const now = Date.now();
  const items = SAMPLE_ITEMS.map((it) => {
    const { expires, ...rest } = it;
    return {
      id: uid('it'), ...rest,
      qty: rest.qty ?? null, fill: rest.fill ?? null,
      expiresAt: expires ? now + expires * DAY - 3600000 : null,
      frozenAt: it.loc === 'freezer' ? now - 5 * DAY : null,
      openedAt: null, price: null, shape: rest.type === 'continuous' ? (rest.unit === 'L' ? 'bottle' : 'jar') : null,
      updated_at: now,
    };
  });
  const recipes = SAMPLE_RECIPES.map((r) => ({ id: uid('rc'), ...r, missingItem: r.missingItem ?? null, updated_at: now }));
  const shopping = SAMPLE_SHOPPING.map((s) => ({ id: uid('sh'), count: 1, ...s, updated_at: now }));
  // Tiendas ficticias en vez de las de los datos de prueba.
  const STORE = { Mercadona: 'Mercado Verde', Lidl: 'Súper Ahorro', Carrefour: 'Hiper Sol', OpenCor: 'Tienda 24h' };
  const dayStr = (n) => { const d = new Date(now - n * DAY); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const L = (name, emoji, category, price, qty = 1, unit = 'uds') => ({ name, emoji, category, price, qty, unit });
  const extra = [
    { date: dayStr(12), amount: 64.2, cat: 'super', store: 'Hiper Sol', savedOnDiscounts: 3.4, items: [
      L('Pechuga de pollo', '🍗', 'carne', 8.9, 1, 'kg'), L('Ternera picada', '🥩', 'carne', 6.4), L('Merluza', '🐟', 'pescado', 9.8),
      L('Yogures x8', '🍦', 'lacteo', 3.2), L('Queso manchego', '🧀', 'lacteo', 7.9), L('Arroz', '🍚', 'pasta', 2.1),
      L('Fruta variada', '🍎', 'fruta', 7.6), L('Verduras', '🥦', 'verdura', 8.3), L('Zumo', '🧃', 'bebida', 3.5), L('Galletas', '🍪', 'snack', 6.5) ] },
    { date: dayStr(9), amount: 12.3, cat: 'super', store: 'Frutería Lola', savedOnDiscounts: 0, items: [
      L('Tomates', '🍅', 'verdura', 3.1, 1, 'kg'), L('Plátanos', '🍌', 'fruta', 2.4), L('Naranjas', '🍊', 'fruta', 3.9), L('Lechuga', '🥬', 'verdura', 1.2), L('Fresas', '🍓', 'fruta', 1.7) ] },
    { date: dayStr(5), amount: 38.6, cat: 'super', store: 'Mercadona', savedOnDiscounts: 1.9, items: [
      L('Salmón', '🐟', 'pescado', 9.4), L('Leche x6', '🥛', 'lacteo', 6.3), L('Huevos x12', '🥚', 'lacteo', 3.4), L('Pasta', '🍝', 'pasta', 2.6),
      L('Aceite de oliva', '🫒', 'conserva', 8.9), L('Cerveza', '🍺', 'bebida', 4.2), L('Patatas', '🥔', 'verdura', 3.8) ] },
  ];
  const expenses = [...buildSampleExpenses(), ...extra].map((e) => ({ ...e, store: STORE[e.store] || e.store })).map((e) => ({
    id: uid('ex'), date: e.date, amount: e.amount, cat: e.cat, store: e.store,
    savedOnDiscounts: e.savedOnDiscounts, photoUrl: null, updated_at: now,
    items: e.items.map((it, i) => ({ id: `l${seq}-${i}`, name: it.name, emoji: it.emoji, cat: it.category, qty: it.qty, unit: it.unit, price: it.price })),
  }));
  const recipeDetails = [
    ...SAMPLE_RECIPE_DETAILS,
    {
      matchName: 'Pasta de mamá', name: 'Pasta de mamá', time: 25, effort: 2, servings: 4, img: 'pasta',
      desc: 'La de los domingos. Tomate, ajo y paciencia: sabe a casa.',
      ingredients: [
        { name: 'Espaguetis', qty: '400 g', have: true },
        { name: 'Tomates cherry', qty: '12 uds', have: true },
        { name: 'Aceite de oliva', qty: '3 cdas', have: true },
        { name: 'Cebollas', qty: '1 ud', have: true },
        { name: 'Queso rallado', qty: '60 g', have: true },
        { name: 'Albahaca fresca', qty: 'un puñado', have: false, note: 'Opcional' },
      ],
      steps: [
        'Pon a hervir agua con sal y cuece la pasta al dente.',
        'Sofríe la cebolla picada en aceite a fuego suave 8 minutos.',
        'Añade los tomates partidos y deja que se deshagan 10 minutos.',
        'Mezcla la pasta con la salsa y un poco de agua de cocción.',
        'Sirve con queso rallado por encima.',
      ],
      tools: ['Olla', 'Sartén'],
    },
    {
      matchName: 'Tortilla fácil', name: 'Tortilla fácil', time: 15, effort: 1, servings: 2, img: 'tortilla',
      desc: 'Jugosa por dentro, en un cuarto de hora.',
      ingredients: [
        { name: 'Huevos', qty: '4 uds', have: true },
        { name: 'Cebollas', qty: '1 ud', have: true },
        { name: 'Aceite de oliva', qty: '2 cdas', have: true },
        { name: 'Sal', qty: 'al gusto', have: true },
      ],
      steps: ['Pocha la cebolla.', 'Bate los huevos con sal.', 'Cuaja a fuego medio y dale la vuelta.'],
      tools: ['Sartén'],
    },
  ].map((d) => ({ id: uid('rd'), ...d, updated_at: now }));
  return { items, recipes, shopping, expenses, recipeDetails, categories: [], menuPlan: [] };
}

const RES_KEY = {
  items: 'items', recipes: 'recipes', shopping: 'shopping', expenses: 'expenses',
  'recipe-details': 'recipeDetails', categories: 'categories',
};

const me = (prefs) => ({
  id: 'user-1', email: 'laura@lazyfood.app', name: 'Laura', avatar: '🥑',
  prefs,
  households: [{ id: HID, name: 'Casa Lazy', color: '#4A7C3A', budget: 300, onboarded: true, role: 'owner' }],
});

// ─── Respuestas de IA ─────────────────────────────────────────────────
const hubRecipe = (name, time, img, uses, why, missingItem = null) => ({
  name, time, img, uses, why, missingItem,
  tools: ['Sartén'],
  steps: ['Prepara los ingredientes.', 'Cocina a fuego medio.', 'Emplata y disfruta.'],
});

const AI = {
  hub: () => ({
    effortless: [
      hubRecipe('Tostas de tomate y queso', 6, 'tostada', ['Pan de molde', 'Tomates cherry', 'Queso rallado'], 'Tus tomates caducan pronto'),
      hubRecipe('Yogur con manzana y canela', 3, 'fruta', ['Yogur natural', 'Manzanas'], 'Merienda en 3 minutos'),
      hubRecipe('Huevos a la plancha con ensalada', 8, 'huevos', ['Huevos', 'Lechuga', 'Tomates cherry'], 'Aprovecha la lechuga'),
      hubRecipe('Batido de plátano', 4, 'smoothie', ['Plátanos', 'Leche entera'], 'Plátanos muy maduros'),
      hubRecipe('Ensalada de garbanzos', 7, 'ensalada', ['Garbanzos', 'Tomates cherry', 'Cebollas'], 'Sin encender el fuego'),
    ],
    chef: [
      hubRecipe('Pollo al ajillo con arroz', 40, 'pollo', ['Pechuga de pollo', 'Arroz basmati', 'Aceite de oliva'], 'El pollo caduca en 2 días'),
      hubRecipe('Risotto de guisantes', 35, 'risotto', ['Arroz basmati', 'Guisantes', 'Queso rallado'], 'Cremoso y de despensa'),
      hubRecipe('Salmón al horno con verduras', 30, 'salmon', ['Salmón', 'Zanahorias', 'Cebollas'], 'Cena completa'),
      hubRecipe('Ramen casero', 45, 'ramen', ['Pechuga de pollo', 'Huevos', 'Zanahorias'], 'Plan de domingo'),
      hubRecipe('Gambas al curry', 30, 'curry', ['Gambas', 'Arroz basmati', 'Cebollas'], 'Toque exótico'),
    ],
    oneOff: [
      hubRecipe('Tacos de pollo', 25, 'taco', ['Pechuga de pollo', 'Lechuga', 'Tomates cherry'], 'Solo te falta una cosa', 'Tortillas de trigo'),
      hubRecipe('Pizza casera', 35, 'pizza', ['Tomates cherry', 'Queso rallado'], 'Viernes de pizza', 'Masa de pizza'),
      hubRecipe('Sushi bowl', 25, 'sushi', ['Salmón', 'Arroz basmati'], 'Como en el japo', 'Alga nori'),
      hubRecipe('Tortitas americanas', 20, 'pancakes', ['Huevos', 'Leche entera'], 'Desayuno de finde', 'Harina'),
      hubRecipe('Sopa de verduras', 30, 'sopa', ['Zanahorias', 'Cebollas', 'Guisantes'], 'Reconfortante', 'Puerro'),
    ],
  }),
  chat: () => ({
    intro: '¡Tengo justo lo que buscas! Con lo que hay en tu nevera te propongo tres ideas rápidas y reconfortantes:',
    recipes: [
      {
        name: 'Pasta cremosa de tomate', time: 20,
        uses: ['Espaguetis', 'Tomates cherry', 'Queso rallado'],
        why: 'Aprovecha los tomates que caducan en 4 días',
        tools: ['Olla', 'Sartén'],
        steps: ['Cuece la pasta.', 'Saltea los tomates con aceite.', 'Mezcla con queso y un chorrito de agua de cocción.'],
      },
      {
        name: 'Huevos rotos con verduras', time: 15,
        uses: ['Huevos', 'Cebollas', 'Zanahorias'],
        why: 'Rápido y con lo que ya tienes',
        tools: ['Sartén'],
        steps: ['Pocha la cebolla y la zanahoria.', 'Añade los huevos.', 'Rompe y sirve.'],
      },
      {
        name: 'Arroz salteado con pollo', time: 25,
        uses: ['Arroz basmati', 'Pechuga de pollo', 'Guisantes'],
        why: 'Tu pollo caduca pasado mañana',
        tools: ['Wok'],
        steps: ['Cuece el arroz.', 'Dora el pollo en tiras.', 'Saltea todo junto con los guisantes.'],
      },
    ],
  }),
  receipt: () => {
    const d = new Date();
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return {
      store: 'Mercado Verde', date, total: 22.85, savedOnDiscounts: 1.2,
      items: [
        { name: 'Aguacates', qty: 2, price: 2.4, category: 'fruta', loc: 'fridge', type: 'discrete', unit: 'uds', shape: null, expiresInDays: 5, emoji: '🥑' },
        { name: 'Mozzarella', qty: 1, price: 1.35, category: 'lacteo', loc: 'fridge', type: 'discrete', unit: 'ud', shape: null, expiresInDays: 10, emoji: '🧀' },
        { name: 'Fresas', qty: 1, price: 2.95, category: 'fruta', loc: 'fridge', type: 'discrete', unit: 'ud', shape: null, expiresInDays: 4, emoji: '🍓' },
        { name: 'Pimientos rojos', qty: 3, price: 2.1, category: 'verdura', loc: 'fridge', type: 'discrete', unit: 'uds', shape: null, expiresInDays: 8, emoji: '🫑' },
        { name: 'Salsa de soja', qty: 1, price: 1.65, category: 'salsa', loc: 'pantry', type: 'continuous', unit: 'L', shape: 'bottle', expiresInDays: 365, emoji: '🍶' },
        { name: 'Pan integral', qty: 1, price: 1.4, category: 'pasta', loc: 'pantry', type: 'discrete', unit: 'ud', shape: null, expiresInDays: 6, emoji: '🍞' },
        { name: 'Leche de avena', qty: 2, price: 3.0, category: 'bebida', loc: 'pantry', type: 'continuous', unit: 'L', shape: 'bottle', expiresInDays: 60, emoji: '🥛' },
        { name: 'Pizza margarita', qty: 1, price: 3.25, category: 'congelado', loc: 'freezer', type: 'discrete', unit: 'ud', shape: null, expiresInDays: 120, emoji: '🍕' },
        { name: 'Chocolate negro', qty: 2, price: 3.4, category: 'snack', loc: 'pantry', type: 'discrete', unit: 'uds', shape: null, expiresInDays: 200, emoji: '🍫' },
        { name: 'Limones', qty: 1, price: 1.35, category: 'fruta', loc: 'fridge', type: 'discrete', unit: 'ud', shape: null, expiresInDays: 20, emoji: '🍋' },
      ],
    };
  },
  replacement: () => hubRecipe('Crema de calabacín', 25, 'sopa', ['Cebollas', 'Queso rallado'], 'Ligera y suave'),
  scale: () => ({ ingredients: [
    { index: 0, qty: '600 g' }, { index: 1, qty: '18 uds' }, { index: 2, qty: '4 cdas' },
    { index: 3, qty: '2 uds' }, { index: 4, qty: '90 g' }, { index: 5, qty: 'un buen puñado' },
  ] }),
  autoplan: (schema) => {
    const slots = schema?.properties?.assignments?.items?.properties?.slot?.enum || [];
    const ids = schema?.properties?.assignments?.items?.properties?.recipeId?.enum || [];
    const assignments = slots.map((slot, i) => ({ slot, recipeId: ids[(i * 3 + 1) % ids.length] }));
    return { assignments };
  },
};

function classifyAi(payload) {
  const schema = payload?.generationConfig?.responseSchema;
  const props = schema?.properties || {};
  if (props.assignments) return ['autoplan', schema];
  if (props.effortless) return ['hub', schema];
  if (props.intro || (props.recipes && !props.store)) return ['chat', schema];
  if (props.store || ('total' in props)) return ['receipt', schema];
  if (props.ingredients) return ['scale', schema];
  if (props.img && props.steps) return ['replacement', schema];
  return ['chat', schema];
}

const geminiWrap = (obj) => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] });

export async function installMock(context, { store, prefs = { palette: 'huerto', font: 'playful', lang: 'es' }, aiDelay = {} } = {}) {
  const state = { prefs: { ...prefs }, store };
  await context.route(`${API_BASE}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.slice(new URL(API_BASE).pathname.length).replace(/\/+$/, '');
    const m = req.method();
    const body = (() => { try { return req.postDataJSON(); } catch { return null; } })();
    const reply = (status, data) => route.fulfill({ status, contentType: 'application/json', body: data == null ? '' : JSON.stringify(data) });
    const now = Date.now();

    if (path === '/me' && m === 'GET') return reply(200, me(state.prefs));
    if (path === '/me' && m === 'PATCH') { if (body?.prefs) Object.assign(state.prefs, body.prefs); return reply(200, { ok: true }); }
    if (path === '/ai' && m === 'POST') {
      const [kind, schema] = classifyAi(body?.payload);
      const delay = aiDelay[kind] ?? 900;
      await new Promise((r) => setTimeout(r, delay));
      return reply(200, geminiWrap(AI[kind](schema)));
    }

    const hm = path.match(/^\/households\/([\w-]+)(\/.*)?$/);
    if (hm) {
      const sub = hm[2] || '';
      if (sub === '' && m === 'GET') return reply(200, { id: HID, name: 'Casa Lazy', color: '#4A7C3A', budget: 300, members: [
        { id: 'user-1', userId: 'user-1', name: 'Laura', email: 'laura@lazyfood.app', role: 'owner', avatar: '🥑' },
        { id: 'user-2', userId: 'user-2', name: 'Dani', email: 'dani@lazyfood.app', role: 'member', avatar: '🍋' },
      ] });
      if (sub === '' && m === 'PATCH') return reply(200, { ok: true });
      if (sub === '/invites' && m === 'POST') return reply(200, { token: 'Kx7pQ2', url: 'https://lazyfood.pages.dev/?invite=Kx7pQ2' });
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
          const rows = since > 0 ? table.filter((r) => r.updated_at > since) : table;
          return reply(200, { rows, serverTime: now });
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
    try { localStorage.setItem('lf_jwt', 'demo.jwt.token'); } catch {}
  });
}

export const HOUSEHOLD_ID = HID;
