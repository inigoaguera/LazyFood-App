// Endpoint para subir TODO el contenido de v1 (Dexie local) a la nube en una pasada.
// Adicionalmente, los items embebidos en cada expense se crean como items de
// inventario VINCULADOS al expense (items.expense_id = expense.id).
import { json, errorResponse, safeJson, uuid, now } from '../util.js';
import { isMember } from './households.js';
import { RESOURCES, fromClient, quoteColumn } from './resources.js';

// Para cada categoría damos una estimación de caducidad por defecto (días).
const EXPIRES_BY_CAT = {
  lacteo: 7, verdura: 5, fruta: 7, carne: 3, pescado: 2,
  pasta: 180, conserva: 365, bebida: 90, snack: 60, congelado: 30,
};
function defaultExpires(cat) { return EXPIRES_BY_CAT[cat] ?? 14; }

export async function bulkImport(request, env, cors, auth, hid) {
  const role = await isMember(env, hid, auth.userId);
  if (!role) return errorResponse('FORBIDDEN', 'No perteneces', 403, cors);
  const body = await safeJson(request) || {};

  const t = now();
  const stmts = [];
  const counts = {};

  // Resources sin tratamiento especial (recipes, shopping, recipeDetails)
  for (const key of Object.keys(RESOURCES)) {
    if (key === 'expenses' || key === 'items') continue; // se procesan más abajo con linkage
    const spec = RESOURCES[key];
    const list = body[key] || [];
    if (!Array.isArray(list)) continue;
    counts[key] = 0;
    for (const raw of list) {
      const data = fromClient(spec, raw);
      const cols = Object.keys(data);
      const id = uuid();
      const colSql = ['id', 'household_id', 'updated_at', ...cols].map(quoteColumn).join(', ');
      const placeholders = ['?', '?', '?', ...cols.map(() => '?')].join(', ');
      stmts.push(
        env.lazyfood_db.prepare(
          `INSERT INTO ${spec.table} (${colSql}) VALUES (${placeholders})`
        ).bind(id, hid, t, ...cols.map((c) => data[c]))
      );
      counts[key]++;
    }
  }

  // Items de inventario sueltos (sin expense ligado)
  if (Array.isArray(body.items)) {
    counts.items = 0;
    const spec = RESOURCES.items;
    for (const raw of body.items) {
      // Migrar `expires` (días) → `expiresAt` (timestamp absoluto) si hace falta
      const enriched = { ...raw };
      if (enriched.expiresAt == null && 'expires' in enriched && enriched.expires != null && enriched.expires > 0) {
        enriched.expiresAt = t + Number(enriched.expires) * 86400000;
      }
      delete enriched.expires;
      const data = fromClient(spec, enriched);
      const cols = Object.keys(data);
      const id = uuid();
      const colSql = ['id', 'household_id', 'updated_at', ...cols].map(quoteColumn).join(', ');
      const placeholders = ['?', '?', '?', ...cols.map(() => '?')].join(', ');
      stmts.push(
        env.lazyfood_db.prepare(
          `INSERT INTO ${spec.table} (${colSql}) VALUES (${placeholders})`
        ).bind(id, hid, t, ...cols.map((c) => data[c]))
      );
      counts.items++;
    }
  }

  // Expenses + items vinculados
  if (Array.isArray(body.expenses)) {
    counts.expenses = 0;
    counts.linkedItems = 0;
    const expSpec = RESOURCES.expenses;
    const itemSpec = RESOURCES.items;

    for (const raw of body.expenses) {
      const expenseId = uuid();
      // El expense lo guardamos sin items_json (los items van a la tabla items vinculados).
      const expensePayload = { ...raw };
      const linkedItems = expensePayload.items || [];
      delete expensePayload.items;

      const expData = fromClient(expSpec, expensePayload);
      const expCols = Object.keys(expData);
      const expColSql = ['id', 'household_id', 'updated_at', ...expCols].map(quoteColumn).join(', ');
      const expPlaceholders = ['?', '?', '?', ...expCols.map(() => '?')].join(', ');
      stmts.push(
        env.lazyfood_db.prepare(
          `INSERT INTO ${expSpec.table} (${expColSql}) VALUES (${expPlaceholders})`
        ).bind(expenseId, hid, t, ...expCols.map((c) => expData[c]))
      );
      counts.expenses++;

      // Crear los items vinculados con valores por defecto si no vienen
      for (const lineRaw of linkedItems) {
        const cat = lineRaw.category || lineRaw.cat || 'conserva';
        const type = lineRaw.type || 'discrete';
        const itemData = fromClient(itemSpec, {
          name: lineRaw.name || 'Sin nombre',
          emoji: lineRaw.emoji || '🛒',
          cat,
          loc: lineRaw.loc || guessLoc(cat),
          type,
          qty: lineRaw.qty != null ? Number(lineRaw.qty) : 1,
          fill: type === 'continuous' ? (lineRaw.fill ?? 100) : null,
          unit: lineRaw.unit || 'uds',
          shape: type === 'continuous' ? (lineRaw.shape || 'bottle') : null,
          // Aceptamos expiresAt absoluto, o expires (días) como fallback. Si nada → default por cat.
          expiresAt: lineRaw.expiresAt != null
            ? Number(lineRaw.expiresAt)
            : ('expires' in lineRaw && lineRaw.expires != null
                ? t + Number(lineRaw.expires) * 86400000
                : t + defaultExpires(cat) * 86400000),
          price: lineRaw.price != null ? Number(lineRaw.price) : null,
          expenseId,
        });
        const itemCols = Object.keys(itemData);
        const itemId = uuid();
        const itemColSql = ['id', 'household_id', 'updated_at', ...itemCols].map(quoteColumn).join(', ');
        const itemPlaceholders = ['?', '?', '?', ...itemCols.map(() => '?')].join(', ');
        stmts.push(
          env.lazyfood_db.prepare(
            `INSERT INTO ${itemSpec.table} (${itemColSql}) VALUES (${itemPlaceholders})`
          ).bind(itemId, hid, t, ...itemCols.map((c) => itemData[c]))
        );
        counts.linkedItems++;
      }
    }
  }

  // menuPlan
  if (Array.isArray(body.menuPlan)) {
    counts.menuPlan = 0;
    for (const m of body.menuPlan) {
      if (!m.slot || !m.recipeId) continue;
      stmts.push(
        env.lazyfood_db.prepare(
          `INSERT OR REPLACE INTO menu_plan (household_id, slot, recipe_id, updated_at)
           VALUES (?, ?, ?, ?)`
        ).bind(hid, m.slot, String(m.recipeId), t)
      );
      counts.menuPlan++;
    }
  }

  if (stmts.length > 0) {
    for (let i = 0; i < stmts.length; i += 40) {
      await env.lazyfood_db.batch(stmts.slice(i, i + 40));
    }
  }
  return json({ ok: true, counts }, 200, cors);
}

function guessLoc(cat) {
  if (['lacteo', 'verdura', 'carne'].includes(cat)) return 'fridge';
  if (['congelado', 'pescado'].includes(cat)) return 'freezer';
  return 'pantry';
}
