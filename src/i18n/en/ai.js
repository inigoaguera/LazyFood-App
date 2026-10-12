// Namespace 'ai' — see es/ai.js.
export default {
  directive: `IDIOMA DE SALIDA: el usuario usa la app en INGLÉS. Escribe en inglés natural
todo el texto que vaya a leer (nombres de receta, intro, why, steps, tools,
uses, missingItem, cantidades como "to taste"). Las claves del JSON y los
valores de enum (category, loc, type, unit, shape, img, ids de hueco o de
receta) NO se traducen: van exactamente como se piden arriba.`,
  scaleKeepAsIs: '"to taste", "a pinch", "a handful" (o sus equivalentes en castellano)',
  inv: {
    expired: '⚠ EXPIRED — do not use',
    expiresIn: '⚠ expires in {n}d',
    frozen: '❄ frozen',
  },
};
