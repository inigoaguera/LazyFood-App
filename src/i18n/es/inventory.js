// Namespace 'inventory': Inventory (lista, sheets de mover y agotado) y
// AddEditItem (alta/edición de un alimento, claves `edit.*`).
// Mismas claves en es/ y en/ — ver src/i18n/index.js.
export default {
  title: 'Todos los alimentos',
  found_one: '{n} item encontrado',
  found_other: '{n} items encontrados',
  searchPlaceholder: "Busca 'tomates', 'leche'…",
  allCats: 'Todas',
  sortedBy: 'Ordenado por · caducidad',
  swipeHint: '← desliza para acciones',
  swipe: {
    move: 'Mover',
  },
  emptyList: 'Nada por aquí. Añade algo con el escáner 📸',
  toast: {
    toShopping: '{name} → lista de compra 🛒',
    toShoppingPart: '{qty} de {name} → compra 🛒',
    frozen: '🧊 {name} congelado',
    movedTo: 'Movido a {loc}',
    partMovedTo: '{qty} de {name} → {loc}',
    removed: '{name} eliminado',
  },
  move: {
    title: 'Mover',
    howMuch: '¿Cuánto mueves?',
    ofTotal: 'de {total} {unit}',
    all: 'todo',
    shoppingLabel: 'Lista de la compra',
    shoppingDesc: 'Lo quitas del inventario y se añade a la lista',
  },
  // Paso del stepper (Mover y AddEditItem).
  step: {
    fine: '🔬 paso 0.25',
    normal: 'paso 1 · toca para 0.25',
  },
  // Sheet que sale al pulsar un item agotado.
  soldOut: {
    badge: 'Agotado',
    addToShopping: 'Añadir a la lista de la compra',
    editRestock: 'Editar / reponer',
    removeFromInventory: 'Eliminar del inventario',
    confirmRemove: '¿Eliminar "{name}" del inventario?',
  },
  edit: {
    namePlaceholder: 'Nombre del alimento',
    nameFirst: 'Pon un nombre primero',
    noHousehold: 'Sin casa activa',
    saveFailed: 'No se pudo guardar',
    added: '{name} añadido',
    expiryStarted: 'Caducidad arrancada desde hoy',
    quantity: 'Cantidad',
    continuousSub: 'arroz, leche, aceite…',
    discreteSub: 'huevos, tomates…',
    approx: 'Aprox. {amount} {unit}',
    gaugeHint: '💡 Desliza sobre el envase para marcar cuánto queda',
    location: 'Ubicación',
    category: 'Categoría',
    expires: 'Caduca',
    open: '📦 Abrir — arranca el contador de caducidad',
    openedOn: 'Abierto el {date}',
    deleteItem: 'Eliminar alimento',
  },
};
