// Namespace 'ai': texto que se mete DENTRO de los prompts de Gemini (no se
// enseña tal cual en pantalla). Los prompts largos de src/api.js siguen en
// castellano —están afinados y medidos así—; en inglés se les añade
// `directive` al final para que todo lo visible vuelva en inglés.
export default {
  directive: '',
  // Se añade a los prompts que devuelven `uses` (chat, hub, reemplazo), en los
  // dos idiomas. Va en castellano en ambos diccionarios porque el prompt lo es.
  usesRule: `REGLA PARA "uses": escribe cada ingrediente del inventario con el nombre que
tiene en el inventario, en su mismo idioma, quitando sólo cantidades, tamaños y
envases (si el inventario dice "Pechuga pollo 700g", escribe "pechuga pollo").
La app busca esos nombres en el inventario para saber qué tienes y qué
descontar al cocinar: un sinónimo o una traducción no los encuentra.`,
  scaleKeepAsIs: '"al gusto", "una pizca", "un puñado"',
  inv: {
    expired: '⚠ CADUCADO — no lo uses',
    expiresIn: '⚠ caduca en {n}d',
    frozen: '❄ congelado',
  },
};
