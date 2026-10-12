// Namespace 'ai': texto que se mete DENTRO de los prompts de Gemini (no se
// enseña tal cual en pantalla). Los prompts largos de src/api.js siguen en
// castellano —están afinados y medidos así—; en inglés se les añade
// `directive` al final para que todo lo visible vuelva en inglés.
export default {
  directive: '',
  scaleKeepAsIs: '"al gusto", "una pizca", "un puñado"',
  inv: {
    expired: '⚠ CADUCADO — no lo uses',
    expiresIn: '⚠ caduca en {n}d',
    frozen: '❄ congelado',
  },
};
