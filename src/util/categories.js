// Lista combinada de categorías = defaults (LF_CATEGORIES) + custom (per-casa).
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db.js';
import { LF_CATEGORIES } from '../tokens/categories.js';

// Hook React: devuelve todas las categorías de la casa actual ordenadas:
// primero las defaults, luego las custom (creación por usuario).
export function useCategories(hid) {
  const customs = useLiveQuery(
    () => hid ? db.categories.where({ householdId: hid }).toArray() : Promise.resolve([]),
    [hid], []
  );
  // Mapeamos custom al mismo shape que LF_CATEGORIES { id, label, color }
  const customMapped = (customs || []).map((c) => ({
    id: c.id,
    label: c.name || 'Sin nombre',
    color: c.color || '#C4B8A5',
    emoji: c.emoji || null,
    custom: true,
  }));
  return [...LF_CATEGORIES, ...customMapped];
}

// Lookup (cuando ya tienes la lista combinada).
export function findCategory(catId, allCategories) {
  if (!catId) return null;
  return allCategories.find((c) => c.id === catId) || null;
}
