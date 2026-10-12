// Namespace 'home': pantalla de inicio (Home) y el modal "Usa esto pronto"
// (UseIngredient, claves `use.*`). Mismas claves en es/ y en/ — ver src/i18n/index.js.
export default {
  greeting: {
    morning: 'Buenos días',
    afternoon: 'Buenas tardes',
    evening: 'Buenas noches',
  },
  title: '¿Qué hay hoy por casa?',
  expiringSoon_one: '{n} caduca pronto',
  expiringSoon_other: '{n} caducan pronto',
  urgent_one: '{n} urge',
  urgent_other: '{n} urgen',
  useThisWeek: 'Úsalos esta semana',
  recipesLink: 'Recetas →',
  quick: {
    title: 'Accesos rápidos',
    shopping: 'Lista compra',
    menu: 'Menú semanal',
    menuAssigned: '{n} / 14 asignados',
    tonight: 'Qué ceno hoy',
    tonightSub: 'Sugerencia IA con lo que tienes',
  },
  use: {
    eyebrow: 'Usa esto pronto',
    fromRecipes: 'De tus recetas ({n})',
    noRecipes: 'Aún no tienes recetas guardadas que usen {name}. Pídele a la IA que te proponga.',
    moreIdeas: 'Más ideas con IA',
    // Se enseña como burbuja del chat Y se manda a la IA como petición.
    prompt: 'Recetas usando "{name}" porque me caduca pronto. Comidas/cenas completas.',
  },
};
