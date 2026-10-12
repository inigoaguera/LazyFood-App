// Esquemas de respuesta para las llamadas a Gemini.
//
// Se pasan en `generationConfig.responseSchema`. La diferencia con describir el
// formato dentro del prompt es que aquí no hay promesa: la API garantiza la
// forma. Los números llegan como números (antes `Number(...)` entraba directo a
// D1 sin comprobar), las categorías sólo pueden ser las doce de la lista y los
// campos obligatorios están siempre.
//
// Es un subconjunto de OpenAPI 3.0, NO JSON Schema completo: sólo type,
// properties, required, items, enum, nullable y propertyOrdering. Nada de
// additionalProperties, oneOf ni patrones — por eso el auto-plan devuelve una
// lista de asignaciones en vez de un objeto con los huecos como claves.

const STR = { type: 'STRING' };
const NUM = { type: 'NUMBER' };
const INT = { type: 'INTEGER' };
const STR_LIST = { type: 'ARRAY', items: { type: 'STRING' } };
const NULLABLE_STR = { type: 'STRING', nullable: true };

export const SCAN_CATEGORIES = [
  'lacteo', 'verdura', 'fruta', 'carne', 'pescado', 'pasta',
  'conserva', 'salsa', 'especia', 'bebida', 'snack', 'congelado',
];

export const RECIPE_IMGS = [
  'pasta', 'tortilla', 'caprese', 'bocata', 'huevos', 'tostada', 'risotto',
  'curry', 'salmon', 'paella', 'guaca', 'pizza', 'burger', 'taco', 'ramen',
  'sopa', 'ensalada', 'pollo', 'carne', 'sushi', 'pancakes', 'donut', 'cake',
  'fruta', 'smoothie', 'cafe', 'helado', 'picante', 'bento',
];

// ─── 1. Chat de Antojos ──────────────────────────────────────────────
const CHAT_RECIPE = {
  type: 'OBJECT',
  properties: { name: STR, time: INT, uses: STR_LIST, why: STR, tools: STR_LIST, steps: STR_LIST },
  required: ['name', 'time', 'uses', 'steps'],
  propertyOrdering: ['name', 'time', 'uses', 'why', 'tools', 'steps'],
};

export const SUGGEST_RECIPES_SCHEMA = {
  type: 'OBJECT',
  properties: { intro: STR, recipes: { type: 'ARRAY', items: CHAT_RECIPE } },
  required: ['recipes'],
  propertyOrdering: ['intro', 'recipes'],
};

// ─── 2. Escaneo del ticket ───────────────────────────────────────────
export const RECEIPT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    store: NULLABLE_STR,
    // Nullable a propósito: preferimos que diga "no la he leído" a que se la
    // invente. Una fecha inventada esconde el gasto en un mes equivocado.
    date: NULLABLE_STR,
    total: { type: 'NUMBER', nullable: true },
    savedOnDiscounts: { type: 'NUMBER', nullable: true },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: STR,
          qty: NUM,
          price: { type: 'NUMBER', nullable: true },
          category: { type: 'STRING', enum: SCAN_CATEGORIES },
          loc: { type: 'STRING', enum: ['fridge', 'freezer', 'pantry'] },
          type: { type: 'STRING', enum: ['discrete', 'continuous'] },
          unit: STR,
          shape: { type: 'STRING', enum: ['bottle', 'jar', 'sack'], nullable: true },
          expiresInDays: { type: 'INTEGER', nullable: true },
          emoji: STR,
        },
        required: ['name', 'qty', 'category', 'loc', 'type', 'unit', 'emoji'],
        propertyOrdering: ['name', 'qty', 'price', 'category', 'loc', 'type', 'unit', 'shape', 'expiresInDays', 'emoji'],
      },
    },
  },
  required: ['items'],
  propertyOrdering: ['store', 'date', 'total', 'savedOnDiscounts', 'items'],
};

// ─── 3 y 4. Hub de recetas y reemplazo individual ────────────────────
const HUB_RECIPE = {
  type: 'OBJECT',
  properties: {
    name: STR,
    time: INT,
    img: { type: 'STRING', enum: RECIPE_IMGS },
    uses: STR_LIST,
    tools: STR_LIST,
    steps: STR_LIST,
    why: STR,
    missingItem: NULLABLE_STR,
  },
  required: ['name', 'time', 'img', 'uses', 'tools', 'steps'],
  propertyOrdering: ['name', 'time', 'img', 'uses', 'tools', 'steps', 'why', 'missingItem'],
};

export const HUB_SCHEMA = {
  type: 'OBJECT',
  properties: {
    effortless: { type: 'ARRAY', items: HUB_RECIPE },
    chef: { type: 'ARRAY', items: HUB_RECIPE },
    oneOff: { type: 'ARRAY', items: HUB_RECIPE },
  },
  required: ['effortless', 'chef', 'oneOff'],
  propertyOrdering: ['effortless', 'chef', 'oneOff'],
};

export const REPLACEMENT_SCHEMA = HUB_RECIPE;

// ─── 5. Reescalado de raciones ───────────────────────────────────────
export const SCALE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    ingredients: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        // qty va como texto porque admite "al gusto" o "una pizca".
        properties: { index: INT, qty: STR, unit: STR },
        required: ['index', 'qty'],
        propertyOrdering: ['index', 'qty', 'unit'],
      },
    },
  },
  required: ['ingredients'],
};

// ─── 6. Auto-plan del menú ───────────────────────────────────────────
// Se construye por llamada para poder acotar por enum los huecos válidos y los
// ids de receta existentes: así el modelo no puede devolver un hueco inventado
// ni apuntar a una receta que no está en la casa.
export function autoPlanSchema(slots, recipeIds) {
  return {
    type: 'OBJECT',
    properties: {
      assignments: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            slot: slots.length ? { type: 'STRING', enum: slots } : STR,
            recipeId: recipeIds.length ? { type: 'STRING', enum: recipeIds } : STR,
          },
          required: ['slot', 'recipeId'],
          propertyOrdering: ['slot', 'recipeId'],
        },
      },
    },
    required: ['assignments'],
  };
}
