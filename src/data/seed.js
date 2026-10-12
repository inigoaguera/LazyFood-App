// Datos de prueba / sample data para sembrar una casa rápidamente.
// Se llama desde Profile → "Importar datos de prueba" con el idioma del usuario.
// El contenido vive en seed.es.js y seed.en.js (mismos números, textos traducidos);
// los helpers con fechas (expiresAt, gastos anclados a HOY) se comparten.

import * as es from './seed.es.js';
import * as en from './seed.en.js';
import { buildSampleExpenses, withExpiresAt } from './seed.es.js';

export function buildSamplePayload(lang = 'es') {
  const isEn = lang === 'en';
  const data = isEn ? en : es;
  return {
    items: withExpiresAt(data.SAMPLE_ITEMS),
    recipes: data.SAMPLE_RECIPES,
    shopping: data.SAMPLE_SHOPPING,
    expenses: buildSampleExpenses(isEn ? en.SAMPLE_EXPENSE_NAMES : undefined),
    recipeDetails: data.SAMPLE_RECIPE_DETAILS,
    menuPlan: [],
  };
}
