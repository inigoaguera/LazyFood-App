// Namespace 'domain': etiquetas de los valores que se GUARDAN como claves
// (categorías, ubicaciones, unidades, grupos de receta…). La clave guardada no
// cambia nunca; sólo su etiqueta. Se leen con los helpers de src/i18n/labels.js.
export default {
  cat: {
    lacteo: 'Lácteos',
    verdura: 'Verduras',
    fruta: 'Frutas',
    carne: 'Carne',
    pescado: 'Pescado',
    pasta: 'Pasta & cereales',
    conserva: 'Conservas',
    salsa: 'Salsas',
    especia: 'Especias',
    bebida: 'Bebidas',
    snack: 'Snacks',
    congelado: 'Congelados',
  },
  // Categorías de gasto (expenses.cat) y de línea de ticket sin categoría.
  expenseCat: {
    super: 'Supermercado',
    otros: 'Otros',
  },
  loc: {
    fridge: 'Nevera',
    freezer: 'Congelador',
    pantry: 'Despensa',
  },
  locDesc: {
    fridge: 'Refrigerar',
    freezer: 'Detiene la cuenta de caducidad',
    pantry: 'Conservar a temperatura ambiente',
  },
  type: {
    discrete: 'Unidades',
    continuous: 'Continuo',
  },
  shape: {
    bottle: 'Botella',
    jar: 'Tarro',
    sack: 'Saco',
  },
  // Unidades guardadas → cómo se enseñan. Las métricas son iguales en los dos idiomas.
  unit: {
    uds: 'uds',
    ud: 'ud',
    latas: 'latas',
    paquetes: 'paquetes',
    L: 'L',
    ml: 'ml',
    kg: 'kg',
    g: 'g',
  },
  group: {
    yours: 'Tus recetas',
    effortless: 'Cero esfuerzo',
    chef: 'Modo chef',
    oneOff: 'Te falta 1 ingrediente',
  },
  meal: {
    lunch: 'Comida',
    dinner: 'Cena',
  },
  role: {
    owner: 'Propietario',
    member: 'Miembro',
  },
  stock: {
    ready: 'Tienes todo',
    partial: 'Casi todo',
    missing: 'Te faltan',
  },
  // Etiquetas de caducidad (util/expires.js → expiryStatus().label).
  expiry: {
    frozen: 'congelado',
    sealed: 'sin caducidad',
    expired: 'caducado',
    tomorrow: 'mañana',
    inDays: 'en {n} días',
    inWeeks: 'en {n} sem',
    inMonths: 'en {n} m',
    // Versión corta sin "en", para chips estrechos: "3 días".
    days_one: '{n} día',
    days_other: '{n} días',
  },
};
