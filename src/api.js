// Cliente IA — ahora pasa por el Worker autenticado en /ai con JWT + householdId.
import { api, proxyConfigured as _proxyConfigured } from './api/client.js';
import { getCurrentHousehold } from './api/session.js';

const MODEL = 'gemini-2.5-flash';
export const proxyConfigured = _proxyConfigured;

async function callAi(payload) {
  const householdId = await getCurrentHousehold();
  if (!householdId) throw new Error('Sin casa activa');
  return api('/ai', { method: 'POST', body: { model: MODEL, payload, householdId } });
}

function extractText(geminiResponse) {
  const parts = geminiResponse?.candidates?.[0]?.content?.parts;
  if (!parts) throw new Error('Respuesta vacía del modelo');
  return parts.map((p) => p.text || '').join('').trim();
}

function tryParseJSON(raw) {
  let cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first >= 0 && last > first) cleaned = cleaned.slice(first, last + 1);
  return JSON.parse(cleaned);
}

export async function suggestRecipes({ inventory, userPrompt }) {
  const prompt = `Eres un chef que sugiere recetas usando SÓLO ingredientes que el usuario tiene en casa.

Inventario actual:
${inventory}

Petición del usuario: ${userPrompt}

Responde SÓLO con JSON válido (sin markdown, sin texto extra) con esta forma:
{
  "intro": "frase corta y amistosa de 1 línea",
  "recipes": [
    {
      "name": "Nombre receta",
      "time": 15,
      "uses": ["ingrediente1","ingrediente2"],
      "why": "por qué encaja con la petición (1 frase)",
      "tools": ["sartén honda", "tabla de cortar"],
      "steps": ["Paso 1...", "Paso 2...", "Paso 3..."]
    }
  ]
}
Máximo 3 recetas. Prioriza ingredientes que caduquen pronto. Sólo usa ingredientes del inventario.
Tienen que ser comidas/cenas completas, no snacks. Añade pasos breves (3-6) para que el usuario pueda ejecutarlas.`;

  const res = await callAi({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.8, responseMimeType: 'application/json' },
  });
  return tryParseJSON(extractText(res));
}

export async function scanReceipt({ imageBase64, mimeType = 'image/jpeg' }) {
  const prompt = `Analiza este ticket de supermercado.
Para cada producto comprado dame TODOS estos atributos:
- name: nombre claro y normalizado
- qty: cantidad numérica
- price: precio total de esa línea (qty x precio unitario)
- category: una de [lacteo, verdura, fruta, carne, pescado, pasta, conserva, salsa, especia, bebida, snack, congelado]
- loc: dónde se guarda — uno de [fridge, freezer, pantry]
- type: 'discrete' o 'continuous'.
   * 'discrete' → cosas que se cuentan en unidades enteras: yogures, latas, paquetes, frutas/verduras de pieza, huevos, packs.
     Para 'discrete', unit ∈ {uds, latas, paquetes}. Por defecto 'uds'. Usa 'latas' si claramente son latas y 'paquetes' si es un pack/multipack visible.
   * 'continuous' → cosas que se gastan en volumen/peso desde un recipiente: leche, aceite, sal, azúcar, harina, café molido, arroz/pasta a granel, detergente, vino, refrescos en botella grande.
     Para 'continuous', unit ∈ {L, ml, kg, g}. Elige la que aparezca en el envase.
- shape: SÓLO para 'continuous'. Una de:
   * 'bottle' → líquidos en botella/brick/garrafa (leche, aceite, vino, agua, refresco, detergente líquido, salsas)
   * 'jar' → tarros, latas grandes, botes (mermelada, café molido, especias en bote, miel)
   * 'sack' → sacos/bolsas (arroz, harina, azúcar, legumbres secas, café en grano a granel)
   Para 'discrete' deja shape = null.
- emoji: emoji representativo

- expiresInDays: estima los días hasta caducar SEGÚN dónde se guarda y qué es. Razona así:
   * loc = freezer → 60-180 (carne 60, pescado 60, verdura/congelados 90, helado 120, masa/pan 180)
   * loc = fridge → en refrigerador empieza a contar ya: lácteos abiertos 7 / sellados 14, carne fresca 3, pescado fresco 2, verdura 5-7, fruta 5-10, embutido 7
   * loc = pantry y producto sellado de larga duración → DEVUELVE null si la caducidad real es >12 meses o si el producto NO caduca de forma práctica (sal, azúcar, especias, miel, vinagre, aceite sin abrir, conservas en lata sin abrir, café en grano entero). El usuario empieza a contar cuando lo abre.
   * loc = pantry pero perecedero (pan, plátanos, tomates fuera de nevera): 3-7
   * Pasta/arroz/legumbres secos: 360
   * Si dudas, prefiere null antes que un número arbitrario.

Responde SÓLO con JSON válido sin markdown:
{
  "store": "nombre del super si aparece, si no null",
  "date": "YYYY-MM-DD si aparece, si no null",
  "total": número o null,
  "savedOnDiscounts": número o null,
  "items": [
    {"name": "Leche entera 1L x6", "qty": 1, "price": 6.30, "category": "lacteo", "loc": "fridge", "type": "discrete", "unit": "paquetes", "shape": null, "expiresInDays": 14, "emoji": "🥛"},
    {"name": "Aceite de oliva 1L", "qty": 1, "price": 8.95, "category": "conserva", "loc": "pantry", "type": "continuous", "unit": "L", "shape": "bottle", "expiresInDays": null, "emoji": "🫒"},
    {"name": "Arroz basmati 1kg", "qty": 1, "price": 2.20, "category": "pasta", "loc": "pantry", "type": "continuous", "unit": "kg", "shape": "sack", "expiresInDays": 360, "emoji": "🍚"},
    {"name": "Sal yodada", "qty": 1, "price": 0.65, "category": "conserva", "loc": "pantry", "type": "continuous", "unit": "kg", "shape": "jar", "expiresInDays": null, "emoji": "🧂"}
  ]
}`;
  const res = await callAi({
    contents: [{
      role: 'user',
      parts: [
        { text: prompt },
        { inlineData: { mimeType, data: imageBase64 } },
      ],
    }],
    generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
  });
  return tryParseJSON(extractText(res));
}

// Sugiere recetas para el hub de Recetas, con 3 secciones:
// effortless = listas con lo que tienes, simples; chef = más elaboradas; oneOff = falta 1 ingrediente.
export async function suggestRecipesForHub({ inventory }) {
  const prompt = `Eres un chef que propone recetas con lo que el usuario tiene en su nevera/despensa.

Inventario actual:
${inventory}

Sugiere 15 recetas en total, repartidas en 3 grupos:
1. effortless (5): se preparan con lo que TIENE el usuario. Tiempo <=15 min. Pocos cacharros.
2. chef (5): se preparan con lo que tiene pero más elaboradas. Tiempo 30-60 min.
3. oneOff (5): le falta SÓLO 1 ingrediente concreto que NO tiene en el inventario.

REGLA CRÍTICA: TODAS deben ser comidas o cenas completas que llenen, NO snacks ni picoteos. Una tostada con jamón no vale. Una tostada con jamón + huevo + ensalada sí. La idea es que con esa receta cenas/comes, no que es un "tentempié".

Para cada receta dame:
- name, time (minutos), img (uno de: pasta, tortilla, caprese, bocata, huevos, tostada, risotto, curry, salmon, paella, guaca, pizza, burger, taco, ramen, sopa, ensalada, pollo, carne, sushi, pancakes, donut, cake, fruta, smoothie, cafe, helado, picante, bento)
- uses: lista de ingredientes que usa (3-6 nombres cortos)
- tools: lista de instrumentos GRANDES que se manchan y hay que fregar a mano (sartén honda, olla, batidora, tabla de cortar, horno, vaporera...). NO incluyas cubiertos, vasos ni platos. Para effortless típicamente 1, para chef 2-4.
- steps: lista de 3-6 pasos breves para preparar la receta.
- why: 1 frase corta del por qué encaja (sólo si aplica)
- missingItem: SÓLO en oneOff, el único ingrediente que falta.

Formato — SÓLO JSON válido sin markdown:
{
  "effortless": [
    {
      "name": "Pasta a la boloñesa exprés",
      "time": 12,
      "img": "pasta",
      "uses": ["espaguetis","salsa boloñesa","queso rallado"],
      "tools": ["olla"],
      "steps": ["Pon agua a hervir y cuece la pasta el tiempo del paquete", "Calienta la salsa en una sartén o microondas", "Mezcla y sirve con queso rallado"],
      "why": "comida completa, casi sin esfuerzo"
    }
  ],
  "chef": [
    {
      "name": "Risotto de gambas",
      "time": 45,
      "img": "risotto",
      "uses": ["arroz","gambas","cebolla","caldo"],
      "tools": ["olla","sartén honda"],
      "steps": ["Pocha la cebolla", "Añade arroz y nacara", "Ve añadiendo caldo poco a poco", "Saltea las gambas aparte y añade al final", "Reposa y sirve"],
      "why": "luce mucho con pocos ingredientes"
    }
  ],
  "oneOff": [
    {
      "name": "Pollo al curry",
      "time": 45,
      "img": "curry",
      "uses": ["pollo","cebolla","arroz"],
      "tools": ["sartén honda","olla"],
      "steps": ["Cocina el arroz aparte", "Saltea el pollo en dados", "Añade cebolla y curry", "Cubre con leche de coco y reduce", "Sirve sobre el arroz"],
      "missingItem": "leche de coco"
    }
  ]
}

Si el inventario está vacío o casi vacío, devuelve arrays vacíos pero respeta la estructura.`;

  const res = await callAi({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.85, responseMimeType: 'application/json' },
  });
  return tryParseJSON(extractText(res));
}

// Pide UNA receta de reemplazo para una sección concreta del hub.
// Recibe la lista de "evita estas" para que la IA no repita.
export async function suggestReplacementRecipe({ inventory, section, avoid }) {
  const sectionGuide = {
    effortless: 'Cero esfuerzo: ingredientes que el usuario YA tiene, tiempo <=15 min, pocos cacharros.',
    chef: 'Modo chef: con lo que tiene pero más elaborada, 30-60 min.',
    oneOff: 'Te falta 1 ingrediente: sólo le falta UN ingrediente que NO tiene.',
  };
  const prompt = `Sugiere 1 receta para la sección "${section}".

${sectionGuide[section] || ''}

Evita repetir estas recetas (el usuario las ha descartado o ya las ve):
${avoid.length ? avoid.map((n) => `- ${n}`).join('\n') : '(ninguna)'}

Inventario actual:
${inventory}

Responde SÓLO con JSON válido sin markdown:
{
  "name": "...",
  "time": 25,
  "img": "pasta",
  "uses": ["...","..."],
  "tools": ["..."],
  "steps": ["...","..."],
  "why": "..."
  ${section === 'oneOff' ? ', "missingItem": "..."' : ''}
}

img debe ser una de: pasta, tortilla, caprese, bocata, huevos, tostada, risotto, curry, salmon, paella, guaca, pizza, burger, taco, ramen, sopa, ensalada, pollo, carne, sushi, pancakes, donut, cake, fruta, smoothie, cafe, helado, picante, bento.
La receta debe ser una comida/cena completa, no un snack.`;

  const res = await callAi({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.9, responseMimeType: 'application/json' },
  });
  return tryParseJSON(extractText(res));
}

// Reescala los ingredientes de una receta para nuevas raciones.
// Usa IA para que las cantidades sean coherentes (no todo se escala lineal:
// especias, sal "al gusto", agua de cocción, etc., requieren ajustes).
export async function scaleRecipeServings({ recipeName, fromServings, toServings, ingredients }) {
  const ingrList = ingredients
    .map((i, idx) => `${idx}. ${i.name} — qty: "${i.qty || ''}" unit: "${i.unit || ''}"`)
    .join('\n');
  const prompt = `Tengo esta receta para ${fromServings} raciones y quiero adaptarla a ${toServings} raciones.

Receta: "${recipeName}"
Ingredientes (con su índice):
${ingrList}

Reescala las cantidades de forma COHERENTE:
- La mayoría se escalan linealmente (× ${toServings}/${fromServings} = ${(toServings / fromServings).toFixed(3)}).
- Pero usa criterio: especias / sal / pimienta / aceite para freír / agua de cocción no escalan 1:1.
- Cantidades como "al gusto", "una pizca", "un puñado" se mantienen igual.
- Si la cantidad original está vacía, déjala vacía.
- Mantén el unit original cuando tenga sentido. Si la cantidad escalada es muy grande, puedes cambiar de unidad (ej: 500g → 0.5kg).

Responde SÓLO con JSON válido:
{
  "ingredients": [
    {"index": 0, "qty": "300", "unit": "g"},
    {"index": 1, "qty": "al gusto", "unit": ""}
  ]
}
Mantén el mismo orden y nº de ingredientes que la entrada.`;

  const res = await callAi({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3, responseMimeType: 'application/json' },
  });
  return tryParseJSON(extractText(res));
}

export async function autoPlanMenu({ inventory, recipes, currentPlan, days, meals }) {
  const recipeList = recipes.map((r) => `- [${r.id}] ${r.name} (${r.time}m, esfuerzo ${r.effort}/3)`).join('\n');
  const prompt = `Planifica las comidas y cenas de la semana usando recetas que el usuario YA tiene guardadas.
Prioriza ingredientes que caduquen pronto y evita repetir la misma receta dos días seguidos.

Inventario actual:
${inventory}

Recetas disponibles:
${recipeList}

Slots vacíos a rellenar (mantén estos para no sobrescribir las elecciones del usuario):
${Object.entries(currentPlan).filter(([, v]) => v).map(([k, v]) => `${k} = ${v}`).join('\n') || '(ninguno)'}

Días: ${days.join(', ')}
Comidas: ${meals.join(', ')}

Responde SÓLO con JSON válido:
{
  "plan": {
    "mon-lunch": "<recipeId>",
    "mon-dinner": "<recipeId>"
  }
}
Sólo asigna a slots VACÍOS. Usa los IDs exactos de la lista de recetas.`;

  const res = await callAi({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.6, responseMimeType: 'application/json' },
  });
  return tryParseJSON(extractText(res));
}
