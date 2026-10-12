// Namespace 'ai' — see es/ai.js.
export default {
  directive: `IDIOMA DE SALIDA: el usuario usa la app en INGLÉS. Escribe en inglés natural
todo el texto que vaya a leer (nombres de receta, intro, why, steps, tools,
missingItem, cantidades como "to taste"), salvo "uses", que sigue la regla de
uses de arriba. Las claves del JSON y los valores de enum (category, loc, type,
unit, shape, img, ids de hueco o de receta) NO se traducen: van exactamente
como se piden arriba.`,
  usesRule: `REGLA PARA "uses": escribe cada ingrediente del inventario con el nombre que
tiene en el inventario, en su mismo idioma, quitando sólo cantidades, tamaños y
envases (si el inventario dice "Pechuga pollo 700g", escribe "pechuga pollo").
La app busca esos nombres en el inventario para saber qué tienes y qué
descontar al cocinar: un sinónimo o una traducción no los encuentra.`,
  scaleKeepAsIs: '"to taste", "a pinch", "a handful" (o sus equivalentes en castellano)',
  inv: {
    expired: '⚠ EXPIRED — do not use',
    expiresIn: '⚠ expires in {n}d',
    frozen: '❄ frozen',
  },
};
