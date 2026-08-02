// Cliente IA — ahora pasa por el Worker autenticado en /ai con JWT + householdId.
import { api, proxyConfigured as _proxyConfigured } from './api/client.js';
import { getCurrentHousehold } from './api/session.js';
import {
  SUGGEST_RECIPES_SCHEMA, RECEIPT_SCHEMA, HUB_SCHEMA,
  REPLACEMENT_SCHEMA, SCALE_SCHEMA, autoPlanSchema,
} from './aiSchemas.js';

// Alias dinámico: Google lo reapunta al Flash-Lite más reciente. Se usa alias y
// no un id fijo para no quedarnos anclados a un modelo viejo sin enterarnos;
// avisan por email con dos semanas si el cambio rompe algo.
//
// Flash-Lite y no el Flash grande, medido el mismo día contra la API:
//   | llamada        | gemini-flash-latest (3.6) | flash-lite      |
//   | chat de 3 recetas | 2,4 s y 40,0 s         | 1,0 s y 0,8 s   |
//   | hub de 15 recetas | timeout a los 60 s     | 7,2 s completas |
//   | escaneo de ticket | 2,8 s, datos exactos   | 2,1 s, idénticos|
// Un sondeo de 5 llamadas seguidas al Flash grande dio 39,9 / 40,9 / 59,3 /
// fallo por saturación / 54,0 s: está congestionado en el nivel gratuito.
// Flash-Lite además es el que más peticiones gratuitas permite y el que Google
// recomienda para extracción estructurada, que es justo lo que hace esta app.
const MODEL = 'gemini-flash-lite-latest';
// Respaldo anclado a la versión concreta que hoy hay detrás del alias. Cubre el
// fallo que dejaría la app entera sin IA: que el alias se mueva a un modelo que
// no trague estos parámetros. Pasó de verdad al saltar de 2.5 a 3, cuando
// thinkingBudget dejó de valer y empezó a devolver 400.
const FALLBACK_MODEL = 'gemini-3.5-flash-lite';
export const proxyConfigured = _proxyConfigured;

// Error propio para poder distinguir "la IA contestó algo que no entiendo" de
// "no hay conexión". Antes ambos acababan en el mismo mensaje de red, que
// mandaba a mirar el wifi cuando el wifi estaba perfecto.
export class AiParseError extends Error {
  constructor(raw) {
    super('No he entendido la respuesta de la IA');
    this.name = 'AiParseError';
    this.code = 'AI_PARSE';
    this.raw = raw;
  }
}

// El modelo gasta un presupuesto de razonamiento antes de emitir la respuesta
// visible, y cuando se dispara la salida se trunca a media frase y JSON.parse
// revienta: ése era el fallo intermitente de la IA. Estas llamadas piden JSON
// estructurado y no necesitan razonar, así que van al mínimo con un techo de
// salida holgado.
//
// OJO con el nombre del parámetro, que cambió con Gemini 3 y está medido:
//   thinkingConfig: { thinkingBudget: 0 }      → 400 INVALID_ARGUMENT
//   generationConfig.thinkingLevel (plano)     → 400, campo desconocido
//   thinkingConfig: { thinkingLevel: 'minimal' } → OK, thoughts = 0
// Y sin ponerlo, el esfuerzo por defecto es 'medium': una llamada trivial se
// comió los 60 s de timeout del proxy.
const JSON_GEN_DEFAULTS = {
  responseMimeType: 'application/json',
  maxOutputTokens: 8192,
  thinkingConfig: { thinkingLevel: 'minimal' },
};
// `schema` va aparte para que quede claro que no es opcional: con
// responseSchema la forma de la respuesta la garantiza la API, no el prompt.
const jsonConfig = (schema, extra = {}) => ({ ...JSON_GEN_DEFAULTS, responseSchema: schema, ...extra });

// Las tres llamadas que generan recetas suben a 'medium'. No es por creatividad
// sino por capacidad de obedecer una restricción negativa: "no repitas la base
// de ninguna de estas quince". Medido con seis reemplazos seguidos y la misma
// lista de evitar:
//   minimal → tres de seis eran el mismo arroz con pollo, y colaba arroz con
//             leche como cena pese a la regla explícita de "no postres".
//   medium  → seis platos distintos, ningún postre.
// Cuesta: el reemplazo pasa de ~3 s a ~6,4 s.
const PENSANDO_RECETAS = { thinkingConfig: { thinkingLevel: 'medium' } };

// Las recetas a evitar se le dan CON SU BASE de ingredientes, no sólo el nombre.
// Medido: pidiéndole que evite nombres, el modelo cambia el nombre y devuelve el
// mismo plato — cinco reemplazos seguidos oscilaban entre huevo+tomate y
// pasta+atún con cinco títulos distintos.
function formatAvoid(avoid = []) {
  return avoid
    .map((a) => {
      if (typeof a === 'string') return `- ${a}`;
      if (!a?.name) return null;
      const base = (a.uses || []).slice(0, 4).join(', ');
      return `- ${a.name}${base ? ` (base: ${base})` : ''}`;
    })
    .filter(Boolean)
    .join('\n');
}

async function callAi(payload) {
  const householdId = await getCurrentHousehold();
  if (!householdId) throw new Error('Sin casa activa');
  const body = { model: MODEL, payload, householdId };
  try {
    return await api('/ai', { method: 'POST', body });
  } catch (e) {
    // Se reintenta con el respaldo en dos casos:
    //   4xx → el alias apunta a un modelo que no traga estos parámetros.
    //   503 → el modelo está saturado (llega rápido, ~9 s, así que reintentar
    //         sale barato y suele funcionar: el respaldo va menos cargado).
    // NO se reintenta el 504, que es nuestro propio timeout: repetir una
    // llamada que ya ha tardado dos minutos sólo hace esperar el doble.
    const status = Number(e?.status);
    const reintentable = (status >= 400 && status < 500) || status === 503;
    if (!reintentable) throw e;
    console.warn(`[lazyfood] ${MODEL} falló (${status}), reintento con ${FALLBACK_MODEL}:`, e?.message);
    return api('/ai', { method: 'POST', body: { ...body, model: FALLBACK_MODEL } });
  }
}

// Llama, extrae y parsea. Si el JSON viene roto reintenta una vez: el truncado
// depende del razonamiento que gaste el modelo en cada ejecución concreta.
async function callAiJson(payload) {
  try {
    return tryParseJSON(extractText(await callAi(payload)));
  } catch (e) {
    if (e?.code !== 'AI_PARSE') throw e;
    return tryParseJSON(extractText(await callAi(payload)));
  }
}

function extractText(geminiResponse) {
  const parts = geminiResponse?.candidates?.[0]?.content?.parts;
  if (!parts) throw new Error('Respuesta vacía del modelo');
  return parts.map((p) => p.text || '').join('').trim();
}

function tryParseJSON(raw) {
  let cleaned = String(raw || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  // Acepta objeto o array en el nivel superior; antes sólo contemplaba `{`.
  const starts = [cleaned.indexOf('{'), cleaned.indexOf('[')].filter((i) => i >= 0);
  if (starts.length) {
    const first = Math.min(...starts);
    const closer = cleaned[first] === '{' ? '}' : ']';
    const last = cleaned.lastIndexOf(closer);
    if (last > first) cleaned = cleaned.slice(first, last + 1);
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new AiParseError(raw);
  }
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

  return callAiJson({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: jsonConfig(SUGGEST_RECIPES_SCHEMA, { temperature: 0.8, ...PENSANDO_RECETAS }),
  });
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
  return callAiJson({
    contents: [{
      role: 'user',
      parts: [
        { text: prompt },
        { inlineData: { mimeType, data: imageBase64 } },
      ],
    }],
    // La única de las seis que sube del mínimo: aquí no se rellena un formato
    // dado, hay que mirar una foto, distinguir columnas y entender que "2,35"
    // es un precio y "26/06/26" una fecha. Se queda en 'low' y no en 'medium'
    // porque esta llamada ya carga con la imagen y hay timeout en el proxy.
    generationConfig: jsonConfig(RECEIPT_SCHEMA, {
      temperature: 0.2,
      thinkingConfig: { thinkingLevel: 'low' },
    }),
  });
}

// Sugiere recetas para el hub de Recetas, con 3 secciones:
// effortless = listas con lo que tienes, simples; chef = más elaboradas; oneOff = falta 1 ingrediente.
export async function suggestRecipesForHub({ inventory, avoid = [] }) {
  const prompt = `Eres un chef que propone recetas con lo que el usuario tiene en su nevera/despensa.

Inventario actual:
${inventory}

Sugiere 15 recetas en total, repartidas en 3 grupos:
1. effortless (5): se preparan con lo que TIENE el usuario. Tiempo <=15 min. Pocos cacharros.
2. chef (5): se preparan con lo que tiene pero más elaboradas. Tiempo 30-60 min.
3. oneOff (5): le falta SÓLO 1 ingrediente concreto que NO tiene en el inventario.

REGLA CRÍTICA: TODAS deben ser comidas o cenas completas que llenen, NO snacks ni picoteos ni postres. Una tostada con jamón no vale. Una tostada con jamón + huevo + ensalada sí. La idea es que con esa receta cenas/comes, no que es un "tentempié".

VARIEDAD — esto es tan importante como lo anterior:
- Las 15 tienen que ser platos DISTINTOS entre sí, no el mismo plato con otro nombre. "Pasta con atún y tomate" y "Espaguetis rápidos con atún" son la misma cena: no valen las dos.
- Reparte las técnicas: sartén, horno, guiso, plancha, hervido, crudo/ensalada, sopa. Que no sean quince sartenes.
- Varía la base: no montes doce recetas sobre huevo y pasta porque sean lo más fácil.
- Da por hecho que tiene sal, aceite, vinagre, pimienta y especias básicas: no hace falta que aparezcan en el inventario.
- Que apetezca comérselas. Cocina de casa, pero con gracia: no te quedes siempre en lo más obvio salvo que el inventario no dé para más.${avoid.length ? `

YA LE HAS PROPUESTO O HA DESCARTADO ESTAS (con su base de ingredientes):
${formatAvoid(avoid)}
No repitas ninguna NI otra versión con la misma base. Cambiarle el nombre no cuenta: si ahí ya hay algo de huevo con tomate, cambia de ingrediente principal o de técnica.` : ''}

Para cada receta dame:
- name, time (minutos), img (uno de: pasta, tortilla, caprese, bocata, huevos, tostada, risotto, curry, salmon, paella, guaca, pizza, burger, taco, ramen, sopa, ensalada, pollo, carne, sushi, pancakes, donut, cake, fruta, smoothie, cafe, helado, picante, bento)
- uses: 3-6 nombres CORTOS de ingrediente, sin cantidades ni unidades — "arroz", no "Arroz: 1 kg"
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

  return callAiJson({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: jsonConfig(HUB_SCHEMA, { temperature: 0.85, ...PENSANDO_RECETAS }),
  });
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

El usuario YA HA VISTO o ha DESCARTADO estas, con su base de ingredientes:
${avoid.length ? formatAvoid(avoid) : '(ninguna)'}

No propongas ninguna de ellas ni una variación de la misma base: cambiarle el
nombre NO cuenta. "Pasta con atún y tomate" y "Espaguetis rápidos con atún" son
el mismo plato. Si en esa lista ya hay algo de huevo con tomate, o de pasta con
atún, vete a otro ingrediente principal o a otra técnica (horno, guiso, plancha,
hervido, crudo, sopa). Da por hecho que tiene sal, aceite, vinagre, pimienta y
especias básicas aunque no estén en el inventario.

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

Tiene que ser una comida o cena COMPLETA que llene: nada de snacks, picoteos ni
postres. El arroz con leche o unas natillas no son una cena.
uses: 3-6 nombres CORTOS de ingrediente, sin cantidades ni unidades — "arroz",
no "Arroz: 1 kg".`;

  return callAiJson({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: jsonConfig(REPLACEMENT_SCHEMA, { temperature: 0.9, ...PENSANDO_RECETAS }),
  });
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

  return callAiJson({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: jsonConfig(SCALE_SCHEMA, { temperature: 0.3 }),
  });
}

export async function autoPlanMenu({ inventory, recipes, currentPlan, days, meals }) {
  const recipeList = recipes.map((r) => `- [${r.id}] ${r.name} (${r.time}m, esfuerzo ${r.effort}/3)`).join('\n');
  // Sólo se ofrecen los huecos que están libres: el esquema los acota por enum,
  // así que el modelo no puede pisar una elección tuya ni inventarse un hueco.
  const freeSlots = [];
  for (const d of days) for (const m of meals) {
    const slot = `${d}-${m}`;
    if (!currentPlan[slot]) freeSlots.push(slot);
  }
  const prompt = `Planifica las comidas y cenas de la semana usando recetas que el usuario YA tiene guardadas.
Prioriza ingredientes que caduquen pronto y evita repetir la misma receta dos días seguidos.

Inventario actual:
${inventory}

Recetas disponibles:
${recipeList}

Ya ocupados (NO los toques):
${Object.entries(currentPlan).filter(([, v]) => v).map(([k, v]) => `${k} = ${v}`).join('\n') || '(ninguno)'}

Huecos LIBRES que puedes rellenar:
${freeSlots.join(', ') || '(ninguno)'}

Devuelve una lista de asignaciones, cada una con su hueco y el id exacto de una
receta de la lista. No repitas hueco ni asignes a uno que no esté libre.`;

  return callAiJson({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: jsonConfig(
      autoPlanSchema(freeSlots, recipes.map((r) => r.id)),
      { temperature: 0.6 },
    ),
  });
}
