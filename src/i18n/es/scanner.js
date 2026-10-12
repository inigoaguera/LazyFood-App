// Namespace 'scanner': escáner de tickets (cámara, lectura y revisión).
// Mismas claves en es/ y en/ — ver src/i18n/index.js.
export default {
  camera: {
    frame: 'Encuadra el ticket',
    noAccess: 'No he podido acceder a la cámara. Revisa permisos o sube una foto.',
    notReady: 'Cámara aún no lista',
  },
  noProxy: 'Configura VITE_API_PROXY_URL para usar el scanner',
  readFailed: 'No he podido leer el ticket',
  noHousehold: 'Sin casa activa',
  // Se GUARDA como nombre de la tienda cuando el ticket no trae ninguna.
  defaultStore: 'Supermercado',
  added_one: '{n} item añadido',
  added_other: '{n} items añadidos',
  addedWithReceipt_one: '{n} item añadido y ticket registrado',
  addedWithReceipt_other: '{n} items añadidos y ticket registrado',
  scanning: {
    title: 'Leyendo tu ticket…',
    sub: 'Identificando alimentos y categorías con IA. Unos segundos.',
  },
  results: {
    title_one: '¡{n} item detectado!',
    title_other: '¡{n} items detectados!',
    subtitle: 'Revisa y ajusta antes de añadir',
    estimatedTotal: 'No he leído el total en el ticket: lo he sumado de los productos. Puedes corregirlo luego en Gastos.',
    saved: 'Ahorraste {amount} € con ofertas',
    purchaseDate: 'Fecha de la compra',
    dateCorrected: 'La fecha del ticket no me cuadraba, he puesto la de hoy. Cámbiala si la compra fue otro día.',
    addProduct: '+ Añadir producto',
    none: 'No detecté items. Prueba con otra foto.',
    addN_one: 'Añadir {n} item',
    addN_other: 'Añadir {n} items',
  },
  mismatch: {
    title: 'Las cuentas no me cuadran por {diff} €.',
    less: 'Los productos suman menos que el total del ticket: puede que me haya dejado alguna línea. Repásalo y añade lo que falte.',
    more: 'Los productos suman más que el total del ticket: puede que haya duplicado una línea o leído mal un precio.',
  },
  // Editor de cada línea detectada.
  row: {
    name: 'Nombre',
    qtyType: 'Tipo de cantidad',
    discrete: 'Discreto (uds, latas…)',
    continuous: 'Continuo (L, kg…)',
    shape: 'Forma del envase',
    qty: 'Cantidad',
    unit: 'Unidad',
    price: 'Precio',
    cat: 'Categoría',
    loc: 'Ubicación',
    expiresIn: 'Caduca en (días)',
    noExpiry: '— sin caducidad',
    remove: '🗑 Quitar este item',
  },
};
