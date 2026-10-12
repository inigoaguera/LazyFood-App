// Namespace 'chat': el chat de antojos (AntojosChat.jsx).
// Mismas claves en es/ y en/ — ver src/i18n/index.js.
export default {
  // Se GUARDA en el historial del chat al crearse.
  welcome: '¡Hola! Cuéntame qué te apetece y te propongo recetas con lo que tienes en casa. Pídeme rápido, ligero, dulce, sin cocinar… lo que sea.',
  title: '¿Antojos?',
  subtitle: 'Recetas con lo que tienes',
  clearConfirm: '¿Borrar todo el historial de antojos?',
  clearTitle: 'Borrar historial',
  placeholder: 'Me apetece algo cremoso y rapidito…',
  // Envoltorio que se añade al mensaje cuando hay filtros rápidos activos:
  // va a la IA, así que en inglés está redactado como instrucción en inglés.
  constraints: '(restricciones: {list})',
  noProxy: 'Configura VITE_API_PROXY_URL en .env y despliega el worker para que pueda pensar 🤖',
  noIdeas: 'No he sacado ideas claras. ¿Probamos otra cosa?',
  errParse: 'Me he hecho un lío con mi propia respuesta y no he sabido leerla. Vuelve a intentarlo 🙈',
  errRate: 'Demasiadas peticiones seguidas. Espera ~1 minuto y vuelve a probar 🐢',
  errConnect: 'Ups, no he podido conectar. Inténtalo de nuevo en un momento.',
  view: 'Ver receta',
  saved: 'Guardada en "Tus recetas" 💾',
  // Filtros rápidos: `label` es el chip, `prompt` el fragmento que se manda a la IA.
  filter: {
    quick: { label: '⚡ Rápido', prompt: 'menos de 15 minutos' },
    fewdishes: { label: '🍽 Pocos cacharros', prompt: 'que ensucie poco' },
    sweet: { label: '🍰 Dulce', prompt: 'algo dulce' },
    salty: { label: '🧂 Salado', prompt: 'algo salado' },
    light: { label: '🥗 Ligero', prompt: 'algo ligero y saludable' },
    comfort: { label: '🍲 Comfort', prompt: 'comfort food' },
    noheat: { label: '🥶 Sin cocinar', prompt: 'sin encender el fuego' },
    protein: { label: '💪 Proteico', prompt: 'alto en proteína' },
  },
};
