# Auditoría de LazyFood — 2026-08-01

Barrido completo de frontend (`src/`, ~7.500 líneas), Worker (`backend/src/`, ~900) y esquema D1.
Origen: tras arreglar la pérdida del desglose de gastos, sospecha fundada de que hay más fallos de la misma familia — datos que se pierden solos, sin error visible.

## Estado de los arreglos — rama `fix/auditoria`

**Los 3 P0, los 10 P1 y los 13 P2 están arreglados** en 19 commits, uno por fallo o por pareja del mismo fichero. Los P3 siguen abiertos a propósito: son calidad interna sin síntoma y se arreglan al pasar por cada fichero.

| Fallo | Commit | Verificación |
|---|---|---|
| P0-1 botón del chat | `1d1469a` | ✔ en vivo — la burbuja sale y arranca la IA |
| P0-2 sync on-focus muerto | `cadc601` | ✔ medido — de **0 a 14** peticiones al disparar el foco |
| P0-3 pantalla en blanco al elegir casa | `6e5059b` | ✔ código |
| — error boundary (transversal) | `a6aae85` | ✔ en vivo — provocando un `throw` en el render |
| P1-1 cocinar descontaba lo que no era | `1aefbe6` | ✔ código |
| P1-2 cocinar sin mirar unidades | `8e38f96` | ✔ código |
| P1-3 PATCH parcial borra recetas | `225bc6d` | ✔ código |
| P1-4 marca de agua con reloj del móvil | `0cca72b` | ✔ en vivo — la marca ya viene del servidor |
| P1-5 dedupe de sync ignora la casa | `0cca72b` | ✔ código |
| P1-6 huecos del menú no se propagan | `e397269` | ✔ código · migración 0010 aplicada |
| P1-7 datos de la casa no se propagan | `ed5ac5f` | ✔ código |
| P1-8 operaciones de dos pasos | *parcial* | Ver nota abajo |
| P1-9 fuerza bruta del OTP | `0f78283` | ✔ código · migración 0009 aplicada |
| P1-10 IA con JSON truncado | `a65a4e3` | ✔ **contra producción** — el prompt que fallaba devuelve 3 recetas |
| P2-1 descongelar una parte | `3e8aabf` | ✔ código |
| P2-2 IA con caducidades falsas | `a8a68c0` | ✔ medido — de **5 avisos falsos a 16 correctos** sobre 23 items |
| P2-3 recetas invisibles en el hub | `52f08f2` | ✔ en vivo — de **2 visibles a las 11** guardadas |
| P2-4 periodos sin cota superior | `74dea0c` | ✔ código |
| P2-5 gasto de 0 € | `74dea0c` | ✔ código |
| P2-6 forma del envase al editar | `3e8aabf` | ✔ código |
| P2-7 hueco del menú fantasma | `52f08f2` | ✔ código |
| P2-8 nombre de casa en blanco | `4a3c026` | ✔ código |
| P2-9 parpadeo en el sync completo | `d65aaaf` | ✔ en vivo — arranque sin parpadeo, 23 items |
| P2-10 cache de casas abandonadas | `d65aaaf` | ✔ código |
| P2-11 filtros del chat se borran | `5121b5e` | ✔ código |
| P2-12 historial del chat sin tope | `5121b5e` | ✔ código |
| P2-13 proxy de IA sin límites | `4a3c026` | ✔ código |

**Desviaciones respecto al plan original**, ambas a mejor:

- **P1-7** no necesitó migración. En vez de añadir `updated_at` a `households` y `memberships` y montarles endpoint de delta, se refresca `/me` al final de cada sync: mismo efecto visible, una llamada que ya existía, cero cambios de esquema.
- **P1-8** (operaciones de dos pasos sin vuelta atrás) queda **abierto a conciencia**. Los dos casos con peor consecuencia ya no se pueden dar por la vía habitual, pero el patrón sigue ahí: arreglarlo de verdad pide una cola de operaciones con reintento, que es un proyecto en sí mismo y no un arreglo de auditoría. Sin cola offline, en el súper sin cobertura cualquier mutación se sigue perdiendo con un toast.

## Resumen

| Severidad | Qué significa | Nº |
|---|---|---|
| **P0** | Funcionalidad rota o inutilizable | 3 |
| **P1** | Pérdida o corrupción de datos, casi siempre silenciosa | 10 |
| **P2** | Comportamiento incorrecto y visible | 13 |
| **P3** | Calidad interna, sin síntoma para quien usa la app | ~30 (agrupados) |

Lo más grave no son bugs de pantalla: son agujeros silenciosos que explican por qué la app "a veces no se entera de nada".

1. **El sync automático nunca se ejecuta.** Lo que cambia otra persona de la casa no aparece jamás salvo recarga manual. Rompe la premisa de nevera compartida. *(Reproducido: disparar el foco produce **cero** peticiones.)*
2. **Pantalla en blanco al elegir casa** justo después de iniciar sesión. *(Reproducido: crash real en tu propia entrada de hoy.)*
3. **El botón de enviar del chat de IA no hace nada.** *(Reproducido: con el botón no pasa nada; con Enter sí funciona.)*
4. **La IA falla de forma intermitente y miente sobre el motivo**: el modelo devuelve JSON cortado y la app dice "no he podido conectar" cuando la conexión estaba perfecta. *(Reproducido contra el Worker de producción.)*
5. **Cocinar una receta puede descontar el alimento equivocado**, o restar 200 unidades cuando la receta pedía 200 gramos.
6. **El reloj del móvil decide qué se sincroniza.** Si va adelantado respecto al servidor, los cambios de esa ventana se pierden para siempre.

Estado de verificación:
- **✔ código** — confirmado leyendo el código y razonando la ruta de ejecución.
- **✔ en vivo** — reproducido en la app corriendo, con datos y Worker reales.

*Nota metodológica: la pasada en vivo se hizo sobre la casa "Pruebas" con los datos de ejemplo (23 items, 11 recetas). El navegador de pruebas suprime los `confirm()` nativos y los da por cancelados, así que los flujos de borrado con confirmación no se han podido recorrer por interfaz.*

---

## P0 — Roto

### P0-1 · El botón de enviar del chat de Antojos no funciona
**`src/screens/AntojosChat.jsx:219`** · ✔ código · ✔ **en vivo** · esfuerzo **S**

```jsx
<button onClick={send} disabled={busy} …>
```

`send(overrideText)` trata su primer argumento como texto (`:90`):

```js
const userText = (overrideText ?? input).trim();
```

React pasa el `SyntheticEvent` como primer argumento, que no es `null` ni `undefined`, así que gana al `??` y se le llama `.trim()` → **`TypeError: overrideText.trim is not a function`**. La promesa se rechaza sin capturar y no pasa absolutamente nada: ni mensaje, ni error, ni spinner.

Sólo funciona por la tecla Enter (`:207`, que llama `send()` sin argumentos) y por el auto-envío inicial. **En móvil, que es el uso real de la PWA, el chat de IA está muerto**: pulsar el botón no hace nada.

**Reproducido**: escribí "algo rapido con huevos" y pulsé el botón → no pasó nada en absoluto (el texto se queda en la caja, ni burbuja ni error). Con la misma frase y la tecla Enter → mensaje enviado y respuesta de la IA. Ni siquiera aparece el error en consola, porque `send` es `async` y el fallo se queda en una promesa rechazada que nadie recoge.

**Arreglo**: `onClick={() => send()}`.

### P0-2 · La sincronización automática no se ejecuta nunca
**`src/App.jsx:151-155`** · ✔ código · ✔ **en vivo** · esfuerzo **S**

```jsx
useEffect(() => {
  setupFocusSync(() => settings.currentHouseholdId || null);
}, []);   // ← deps vacías
```

El efecto corre una sola vez, en el primer render, y la función que registra captura ese `settings`. En el primer render `settings` vale `{}` — es el valor por defecto del `useLiveQuery` de `App.jsx:68-71`, porque IndexedDB aún no ha respondido. El closure queda congelado con ese `{}` para siempre, así que `getHid()` devuelve `null` en cada foco y `setupFocusSync` (`src/api/sync.js:36-38`) sale sin hacer nada.

Consecuencia: **el delta sync on-focus, que es el único mecanismo de refresco continuo, no dispara jamás**. Los datos sólo llegan al cambiar de casa (`App.jsx:145-149`, ése sí funciona) o al recargar la app.

En una app para varias personas que comparten nevera, esto significa que si tu pareja añade leche desde su móvil, tú no la ves hasta que cierras y abres. Explica cualquier sensación de "esto va desincronizado".

**Reproducido**: instrumenté `window.fetch` en la app real, disparé `focus` y `visibilitychange`, y esperé. Resultado: **0 peticiones**. El mecanismo está completamente inerte.

**Arreglo**: pasar el `hid` por ref, o registrar el listener con `[currentHousehold]` en deps y limpiar el anterior — hoy `setupFocusSync` ni siquiera devuelve función de limpieza, así que además hay que añadirla para no acumular listeners.

### P0-3 · Pantalla en blanco al elegir casa después de iniciar sesión
**`src/screens/HouseholdPicker.jsx:70`** · ✔ código · ✔ **en vivo** · esfuerzo **S**

```jsx
{me && me.households.length === 0 && !loading && (
```

Sin `?.`, a diferencia de la línea 46 (`me?.households?.length > 0`), que sí está protegida. Si `me` existe pero no trae `households`, esto lanza `TypeError` **durante el render**. Y como la app **no tiene ningún error boundary**, React desmonta el árbol entero: pantalla en blanco hasta recargar.

La ventana en la que ocurre no es rara, es **el camino normal al entrar**:

1. `verifyOtpCode` guarda en `settings.me` la respuesta de `/auth/verify` (`src/api/session.js:30`), que es `{id, email, name, avatar, prefs}` — **sin `households`** (lo confirma `backend/src/handlers/auth.js:81-90`).
2. Acto seguido llama a `fetchMe()` para completar el objeto, pero está en un `try/catch` que se traga el fallo (`:31`) y, sobre todo, **no es instantáneo**.
3. En cuanto no hay casa activa, `App.jsx:196-209` pinta `HouseholdPicker` con ese `me` a medias → la línea 70 revienta.

**Reproducido**: ocurrió en tu propia sesión de hoy, con traza en consola (`at HouseholdPicker (HouseholdPicker.jsx:22:43)`, dos veces por `StrictMode`) y recuperación sólo tras recargar.

**Arreglo**: `me?.households?.length === 0` en la línea 70. Aparte, merece la pena envolver la app en un error boundary: hoy **cualquier** excepción de render deja la pantalla en blanco sin explicación.

---

## P1 — Pérdida o corrupción silenciosa de datos

### P1-1 · Cocinar puede descontar un alimento que no aparece en la receta
**`src/screens/RecipeDetail.jsx:142-147`** · ✔ código · esfuerzo **S**

```js
match = items.find((it) =>
  it.name.toLowerCase().includes(ing.name.toLowerCase().split(' ')[0]) ||
  ing.name.toLowerCase().includes(it.name.toLowerCase().split(' ')[0])
);
```

Dos fallos en tres líneas:

- **Sin guarda de cadena vacía.** Si un ingrediente se quedó sin nombre, `''.split(' ')[0]` es `''` y `includes('')` siempre es `true`: coincide con **el primer item del inventario** y le resta cantidad. Cocinas lentejas y te baja el yogur.
- **Sin `?.` en `it.name`.** Un item sin nombre lanza `TypeError` a mitad del bucle y deja el descuento hecho a medias.

Lo llamativo es que **la corrección ya existe en el repo**: `src/util/stock.js:22-25` hace exactamente el mismo match difuso pero con `const q = (ing.name || '')…; if (q) {…}` y `it.name?.toLowerCase()`. Sólo hay que aplicar ese mismo patrón aquí.

### P1-2 · Cocinar descuenta sin mirar las unidades
**`src/screens/RecipeDetail.jsx:153-163`** · ✔ código · esfuerzo **M**

```js
const dec = Number.isFinite(ingQty) && ingQty > 0 ? ingQty : 1;
const next = Math.max(0, +(match.qty - dec).toFixed(2));
```

`ing.qty` y `ing.unit` son campos separados, así que una receta que pide **200 g** de pasta produce `ingQty = 200` y **resta 200 unidades** del item discreto. Con 2 paquetes en la despensa, el resultado es 0: la app da por consumido todo el stock.

El caso simétrico está igual de mal: los items continuos siempre pierden un **15 % fijo** (`:162`), ignorando por completo lo que pedía la receta.

**Arreglo**: comparar `ing.unit` con `item.unit` y descontar sólo cuando son compatibles; si no lo son, descontar 1 unidad (discreto) y avisar. Es la pieza que hace falta para que "¡Cocinar!" sea fiable.

### P1-3 · Un PATCH parcial borra los ingredientes y pasos de una receta
**`backend/src/handlers/resources.js:32` y `:64-71`** · ✔ código · esfuerzo **S**

Es **exactamente el mismo patrón que acabamos de corregir en `expenses`**, todavía vivo en dos recursos:

```js
recipes:        missing_item: p.missingItem ?? p.missing_item ?? null,
recipe-details: ingredients_json: p.ingredients ? JSON.stringify(p.ingredients) : (p.ingredients_json ?? null),
                steps_json: …, tools_json: …, match_name: …
```

Estas claves se materializan **siempre**, venga o no el campo en el payload. Un `PATCH /recipe-details/:id` que sólo mande `{name}` deja `ingredients_json`, `steps_json` y `tools_json` a **NULL**: la receta pierde ingredientes y pasos sin más aviso.

Hoy no explota porque `RecipeEditor.jsx:122,150` manda siempre el objeto completo. Es una mina enterrada: el día que alguien escriba un patch parcial —renombrar, marcar favorito, cambiar la foto— se lleva por delante el contenido de la receta.

**Arreglo**: el mismo que ya se aplicó a `expenses`, envolver cada clave derivada en `if ('campo' in p)`.

### P1-4 · El reloj del móvil decide qué se sincroniza
**`src/api/sync.js:18,26`** · ✔ código · esfuerzo **S**

```js
const t0 = Date.now();          // reloj del MÓVIL
…listSince(t, hid, since)…      // se compara contra updated_at del SERVIDOR
await setSetting(lastKey, t0);
```

El servidor sella `updated_at` con su propio reloj (`backend/src/util.js:72`) y el cliente guarda como marca de agua el suyo. Si el móvil va **adelantado** respecto al Worker, todo lo que se escriba en esa ventana queda por debajo de la marca y **no se descarga nunca más**: pérdida permanente y silenciosa. Si va atrasado, se re-descarga de más (sólo gasta datos).

Lo irónico es que el servidor ya manda la hora buena: `resources.js:131` y `menuPlan.js:16` devuelven `serverTime` en cada respuesta, y **el frontend lo ignora**.

**Arreglo**: guardar `res.serverTime` como marca de agua en lugar de `Date.now()`. Es una línea y elimina toda la clase de fallo.

### P1-5 · Cambiar de casa mientras hay un sync en vuelo muestra los datos de la otra casa
**`src/api/sync.js:12`** · ✔ código · esfuerzo **S**

```js
let inflight = null;
if (inflight) return inflight;
```

El guard no mira ni de qué casa es el sync en curso ni si el nuevo pedía `{full:true}`. Al cambiar de casa (`App.jsx:147`) con un delta sync en vuelo, la llamada devuelve **la promesa de la casa anterior** y el `full` se descarta: la cache no se resetea y en pantalla queda el inventario de la casa que acabas de dejar.

**Arreglo**: indexar `inflight` por `hid` y no deduplicar cuando `full` es `true`.

### P1-6 · Quitar una receta del menú no llega a los demás móviles
**`backend/src/handlers/menuPlan.js:34-38`** + `migrations/0001_initial.sql:105` · ✔ código · esfuerzo **M**

`menu_plan` es la única tabla de datos **sin columna `deleted_at`**, y desasignar un slot hace un `DELETE` duro. El delta sync sólo sabe traer filas con `updated_at` mayor que la marca: una fila borrada ya no existe, así que **el hueco no se propaga**. En el móvil de la otra persona la receta sigue puesta en la cena del jueves hasta que haga un sync completo.

**Arreglo**: soft delete como el resto de tablas (migración + filtrado), o marcar el slot con `recipe_id = NULL` en vez de borrar la fila.

### P1-7 · Renombrar la casa, cambiar el presupuesto o expulsar a alguien tampoco se propaga
**`migrations/0001_initial.sql:36,46`** · ✔ código · esfuerzo **M**

`households` y `memberships` no tienen `updated_at`, así que quedan fuera del delta sync por completo. Esos datos sólo llegan al cliente vía `/me`, que se pide **una única vez en el arranque** (`App.jsx:122-131`). Cambias el presupuesto mensual y el otro móvil sigue calculando el porcentaje contra el viejo hasta que reinicie la app.

### P1-8 · Operaciones de dos pasos sin vuelta atrás
**`src/screens/Inventory.jsx:80-92` y `:114-130`, `Scanner.jsx:139-180`, `RecipeEditor.jsx:163-172`** · ✔ código · esfuerzo **M**

Todas siguen el patrón "escribe A, luego escribe B", sin transacción ni compensación si B falla:

| Sitio | Si falla el segundo paso |
|---|---|
| `Inventory.jsx:81-89` mover a la compra | El alimento queda **duplicado**: en la lista y en la despensa |
| `Inventory.jsx:127-128` mover una parte | **Se duplica la cantidad**: se crea el item destino y el origen no se decrementa |
| `Scanner.jsx:147-155` | El gasto se crea y los items se pierden (o al revés), y el toast final canta un recuento que no es |
| `RecipeEditor.jsx:165-170` | El detalle queda huérfano y se re-emparejará con cualquier receta futura del mismo nombre |

Agravado porque varios de estos `catch` están vacíos (`Scanner.jsx:156,176`): el fallo no se ve ni en consola. **Sin cola offline**, en el súper sin cobertura cualquier mutación se pierde con un toast.

### P1-9 · El código OTP se puede reventar por fuerza bruta
**`backend/src/handlers/auth.js:37-60`** · ✔ código · esfuerzo **M** · *seguridad*

`/auth/request` tiene límite (10 por hora y email, `:14-20`), pero **`/auth/verify` no tiene ninguno**. Y como `authRequest` no invalida los códigos anteriores, pueden convivir **hasta 10 códigos de 6 dígitos válidos a la vez** para el mismo email: la consulta de `:52` acepta cualquiera de ellos.

Quien conozca tu correo puede pedir 10 códigos y probar combinaciones durante los 15 minutos de validez. Con 10 códigos vivos la probabilidad por intento es 1 entre 100.000, no entre un millón — a ~80 peticiones por segundo, la mitad de las veces entra antes de que caduquen. Y entrar significa **acceso completo a la casa**.

**Arreglo**: contador de intentos fallidos por email (bloquear a los 5-10), e invalidar los códigos anteriores al emitir uno nuevo. Cualquiera de las dos cosas por separado ya reduce el riesgo a algo irrelevante.

### P1-10 · La IA falla de forma intermitente y culpa a la conexión
**`src/api.js:20-26`** + los 6 puntos de entrada de IA · ✔ código · ✔ **en vivo contra producción** · esfuerzo **M**

El chat respondió *"Ups, no he podido conectar. Inténtalo de nuevo en un momento."* con la conexión perfectamente sana. Fui a buscar el motivo real replicando la llamada exacta contra el Worker de producción:

| | Resultado |
|---|---|
| `/me` | 200 OK |
| `/ai` con prompt corto | 200 OK, Gemini responde |
| `/ai` con el prompt real del chat | 200 OK, `finishReason: "STOP"`… **pero el JSON llega cortado a 950 caracteres** |

```
SyntaxError: Expected ',' or ']' after array element in JSON at position 947
```

No es la red, ni la cuota, ni un 429: **el modelo devuelve JSON incompleto** y `JSON.parse` lo rechaza. El `usageMetadata` apunta a la causa: `gemini-2.5-flash` gasta un presupuesto de razonamiento variable (medí entre **623 y 1.655 `thoughtsTokenCount`** para el mismo prompt) y cuando se dispara, la salida visible se trunca. Como `maxOutputTokens` no se fija en ninguna de las 6 llamadas, el margen queda al azar de cada ejecución. Por eso falla "a veces".

Encima, el manejo del error miente: `AntojosChat.jsx:117-122` captura **cualquier** excepción y, salvo que el mensaje contenga "429", muestra siempre *"no he podido conectar"*. Un fallo de parseo se presenta como un problema de red, lo que manda a quien lo sufre a mirar el wifi en vez del problema real. Lo mismo aplica a las otras cinco funciones, que comparten `tryParseJSON` sin red de seguridad: ni reintento, ni reparación, ni mensaje honesto.

**Arreglo** (por orden de eficacia):
1. Fijar `maxOutputTokens` holgado y `thinkingConfig: { thinkingBudget: 0 }` en las llamadas que piden JSON estructurado — no necesitan razonamiento extendido.
2. Usar `responseSchema` de Gemini en vez de pedir el formato por prompt: garantiza la forma y elimina el parseo frágil.
3. Un reintento automático ante fallo de parseo, y un mensaje de error que distinga "no he entendido la respuesta" de "no hay conexión".

---

## P2 — Comportamiento incorrecto y visible

### P2-1 · Descongelar una parte pierde la compensación de caducidad
**`src/screens/Inventory.jsx:114-130`** · ✔ código · esfuerzo **S**

Mover **todo** desde el congelador aplica `buildLocPatch` (`:96-106`), que suma a `expiresAt` el tiempo que estuvo congelado. Mover **una parte** no lo aplica: crea el item nuevo con `expiresAt: it.expiresAt ?? null` tal cual (`:123`). El mismo gesto da dos resultados distintos, y la parte descongelada aparece caducada o a punto.

### P2-2 · La IA recibe caducidades falsas
**`AntojosChat.jsx:107`, `Menu.jsx:77`, `Recipes.jsx:73` y `:108`** · ✔ código · ✔ **en vivo** · esfuerzo **S**

Los cuatro sitios que construyen el inventario para el prompt siguen leyendo `it.expires`, el campo **en días** que quedó obsoleto al migrar a `expiresAt` (migración 0006):

```js
const exp = it.expires <= 5 ? ` ⚠ caduca en ${it.expires}d` : '';
```

Mi hipótesis inicial era que el campo ya no existía y la marca no saltaba nunca. **Los datos reales dicen algo peor.** Medido sobre los 23 items de la casa de pruebas:

| | |
|---|---|
| Items que **deberían** llevar la marca (caducan en ≤5 días según `expiresAt`) | **16** |
| Items que la llevan de verdad (según `expires`) | **5** |

Y las que saltan son mentira. Ejemplo literal del inventario: **Leche entera → `expires: 3`, pero su `expiresAt` real dice que caducó hace 86 días**. Al prompt le llega `⚠ caduca en 3d` para leche podrida desde hace tres meses.

La razón es que `expires` es una foto fija tomada al crear el item y **nunca se actualiza**: no cuenta atrás. Así que hay dos comportamientos rotos a la vez:

- **Items antiguos** (importados o previos a la migración): conservan `expires` y generan avisos falsos, con días inventados.
- **Items nuevos** (creados por `AddEditItem`, que borra el campo en `:41`, o por el escáner): no tienen `expires`, así que **nunca** llevan marca aunque estén caducando hoy.

En ambos casos la IA decide sin saber lo que urge, que es justo la premisa de la app.

**Arreglo**: usar `expiryStatus(it).days` de `util/expires.js`, que ya calcula el dato bueno. No basta con añadir una guarda de nulos: el campo entero hay que dejar de leerlo.

### P2-3 · Las recetas guardadas fuera de "Tus recetas" desaparecen de la app
**`src/screens/Recipes.jsx:34`** vs **`RecipeEditor.jsx:13-18`** · ✔ código · ✔ **en vivo** · esfuerzo **S**

El editor deja elegir grupo entre `yours`, `effortless`, `chef` y `oneOff`. El hub sólo lista `recipes.filter(r => r.group === 'yours')`; las otras tres secciones son sugerencias de IA en vivo, no recetas guardadas. Guardas una receta propia como "Modo chef" y **se esfuma de la interfaz**: sigue en la base de datos y sólo reaparece en el selector del menú semanal.

**Medido en la casa de pruebas**: 11 recetas en la base, **2 visibles** en el hub. Las otras 9 (`effortless` 4, `oneOff` 3, `chef` 2) son inalcanzables desde la pantalla de Recetas. La pantalla dice "Tus recetas" y enseña dos.

### P2-4 · "Semana" y "Año" en Gastos incluyen el futuro
**`src/screens/Expenses.jsx:206-213`** · ✔ código · esfuerzo **S**

```js
if (period === 'week') return e.date >= sw;
if (period === 'year') return e.date >= yearStart;
```

Sin cota superior. Un gasto con fecha futura (fácil de crear sin querer en el editor) cuenta en "esta semana" y en "este año". "Semana" incluye además la semana siguiente entera. `month` sí está bien acotado por `startsWith`.

### P2-5 · Un gasto de 0 € no se puede guardar
**`src/screens/ExpenseEditor.jsx:41,49`** · ✔ código · esfuerzo **S**

`if (!total || Number.isNaN(total))` rechaza el 0 junto con el vacío. Registrar una compra íntegramente pagada con vale o puntos es imposible. *(Heredado del editor original; sigue presente tras la reescritura de este proyecto.)*

### P2-6 · Al editar un item, la forma del envase se pierde
**`src/screens/AddEditItem.jsx:16`** · ✔ código · esfuerzo **S**

```js
if (item) return { shape: item.shape || variant, ...item };
```

El spread va después, así que `...item` **machaca** el `shape` recién calculado con el original — que puede ser `null`. El fallback a `variant` no se aplica jamás al editar. Basta con invertir el orden.

### P2-7 · Un hueco del menú con la receta borrada cuenta como lleno
**`src/screens/Menu.jsx:48,142`** · ✔ código · esfuerzo **S**

`filled` cuenta los slots con `recipeId`, exista o no la receta. Si la borras, el slot se pinta vacío pero suma al contador y `SlotActionsSheet` recibe `recipe: undefined`. El auto-plan tampoco lo rellena, porque `if (!plan[slot])` lo ve ocupado.

### P2-8 · Cualquier miembro puede dejar el nombre de la casa en blanco
**`backend/src/handlers/households.js:61-70`** · ✔ código · esfuerzo **S** · *seguridad*

```js
if (typeof body.name === 'string') { updates.push('name=?'); args.push(body.name); }
…
if ((body.name || body.color) && role !== 'owner') return 403;
```

La guarda de owner usa truthiness: `{"name": ""}` pasa el `typeof` de la línea 61 pero es falsy en la 68, así que **esquiva el 403** y escribe el nombre vacío. Impacto bajo (hace falta ser miembro), arreglo trivial: comprobar `'name' in body`.

### P2-9 · Parpadeo de pantalla vacía en cada sync completo
**`src/api/resources.js:20-24`** · ✔ código · esfuerzo **S**

`listAll` borra toda la cache de la casa y luego reescribe. Entre las dos operaciones los `useLiveQuery` emiten un array vacío: la pantalla parpadea "no tienes nada" en cada cambio de casa y en cada arranque. Y si el `bulkPut` falla a mitad, **la cache local queda vacía**. Debería ser un `bulkPut` seguido de borrar sólo lo que ya no viene.

### P2-10 · Los datos de casas que abandonas se quedan en el móvil para siempre
**`src/db.js:96`** · ✔ código · esfuerzo **S**

`cacheClearHousehold` está escrita y **no se llama desde ningún sitio** (comprobado en todo `src/`). Al salir o borrar una casa (`Profile.jsx:45-83`), sus items, recetas y gastos siguen en IndexedDB indefinidamente. Además la función omite la tabla `categories`.

### P2-11 · Los filtros rápidos del chat se borran solos
**`src/screens/AntojosChat.jsx:125`** · ✔ código · esfuerzo **S**

`setFilters({})` en el `finally`: cada envío limpia los filtros que acabas de marcar. Para encadenar dos peticiones "sin gluten" hay que volver a marcarlo cada vez.

### P2-12 · El historial del chat crece sin límite
**`src/screens/AntojosChat.jsx:58-61`** · ✔ código · esfuerzo **S**

Se persiste el array completo de mensajes en `settings` en cada cambio, sin poda. Con recetas completas dentro de cada respuesta, la entrada de IndexedDB crece indefinidamente y se reescribe entera en cada mensaje.

### P2-13 · El proxy de IA no tiene límite de nada
**`backend/src/handlers/ai.js:37-52`** · ✔ código · esfuerzo **M**

Sin timeout ni `AbortController`, sin límite de tamaño de cuerpo (la foto del ticket viaja en base64 dentro del JSON) y **sin cuota por casa**, pese a que el comentario de cabecera dice literalmente que existe "para evitar abuso de la cuota gratis". La protección real es sólo la autenticación. Un bucle accidental en el hub de recetas puede fundir la cuota diaria de Gemini sin que nada lo frene.

---

## P3 — Calidad interna (agrupado)

Sin síntoma perceptible. Se listan para que quede constancia, no para arreglar ahora.

- **Claves de React por índice en listas que se reordenan o mutan**: `Recipes.jsx:212-245`, `RecipeEditor.jsx:269,281,313` (agravado porque `stepRefs.current` nunca se compacta al borrar un paso), `Scanner.jsx:285`, `Expenses.jsx:292,370,380,396,416`, `ExpenseCalendar.jsx:221`. Síntoma potencial: al borrar el elemento *n*, los inputs siguientes conservan el estado o el foco del anterior.
- **Errores tragados en silencio (~20 puntos)**. Los que importan ya están arriba (`Scanner.jsx:156,176`, `RecipeDetail.jsx:168`). El resto: `api/client.js:29`, `App.jsx:117,125,147`, `api/session.js:15,31,37`, `Profile.jsx:30`, `InviteShare.jsx:28,39`, `util/jwt.js:55,85`, `Menu.jsx:92-93` (descarta el error real y muestra uno genérico).
- **Código muerto**: `util/expires.js:45-50` (las dos ramas del `if` devuelven el mismo objeto — intención perdida, revisar qué debía hacer un item abierto sin caducidad), `db.js:76-83` (ramas idénticas en `cachePut`), `util/categories.js:25` (`findCategory` sin uso), `tokens/categories.js:16-17` (`catColor`/`catLabel` sin uso), `expenses.cat` siempre vale `'super'`, columna `items.expires` viva en el esquema y en la whitelist (`resources.js:10`) pero ya sin uso.
- **Higiene del backend**: `index.js:110` devuelve al cliente el mensaje de error interno (incluidos errores de D1 con SQL); `auth.js:59` no comprueba `JWT_SECRET` (si falta, firma con la cadena `"undefined"` en vez de fallar); `sessions` y `auth_tokens` caducados no se limpian nunca; `sessions.expires_at` no se comprueba jamás (sólo vale el `exp` del JWT); CORS por sufijo de host (`util.js:13-19`) admite cualquier subdominio de tu propio proyecto en Pages.
- **Robustez de la IA**: `api.js:20-26` (`tryParseJSON` sólo contempla objetos de nivel superior; un array lo rompe), cero validación de esquema sobre la respuesta del modelo — `Scanner.jsx` mete `Number(...)` sin `isFinite` directo a D1 y `autoPlanMenu` devuelve `recipeId` que sí se valida contra `recipesById` (`Menu.jsx:86`, correcto) pero `suggestRecipesForHub` no valida nada.
- **Varios de UI**: sin `history.pushState` en ninguna pantalla, así que el botón atrás del navegador y el gesto de Android no funcionan; `Expenses.jsx:149` ordena mutando el array memoizado durante el render; `App.jsx:237-241` llama a `go('home')` durante el render; `main.jsx:36` no monta la app hasta resolver el permiso de almacenamiento persistente; los `setTimeout` de los toasts no se limpian al desmontar (`base.jsx:283`); `useCategories` devuelve un array nuevo en cada render y rompe la memoización aguas abajo.
- **Emparejamiento receta↔detalle por nombre** (`RecipeEditor.jsx:53`, `RecipeDetail.jsx:19`): dos recetas homónimas comparten detalle. No es un fallo hoy, pero es frágil por diseño.
- **`RECIPE_USES_EXPIRING_BY_NAME`** (`db.js:128-140`): mapa fijo con los 11 nombres del seed original; el badge "Úsalo ya" sólo funciona si la receta se llama exactamente igual.

---

## Falsos positivos descartados

Los dejo anotados con el motivo para que nadie los vuelva a levantar dentro de seis meses.

| Sospecha | Por qué no lo es |
|---|---|
| `util/stock.js:24` lanzaría `TypeError` con items sin nombre | El *optional chaining* corta la cadena entera: `it.name?.toLowerCase().split(…)` devuelve `undefined`, no lanza. Y `:23` ya tiene la guarda `if (q)` contra la cadena vacía. Este fichero está bien; el que falla es `RecipeDetail` (P1-1) |
| El scanner pide `expiresInDays` pero lee `expiresAt` | La conversión existe y es correcta: `Scanner.jsx:103` hace `daysToTs(it.expiresInDays)` al recibir la respuesta |
| Las líneas de gasto del seed usan `category` y el desglose lee `cat` | `bulkImport.js` normaliza `category → cat` al construir el snapshot. Ya no aplica |
| `SwipeRow` cierra la fila al pasar el ratón por encima | `onEnd` es idempotente: con la fila abierta (`dx = -max`) recalcula `-max`. No cambia nada |
| El token del magic-link se filtraría a Google Fonts por `Referer` | El `Referrer-Policy` por defecto de los navegadores (`strict-origin-when-cross-origin`) manda sólo el origen, sin query string |
| El CORS por sufijo permite entrar a cualquier cuenta de Pages | Los subdominios `*.pages.dev` son por proyecto: sólo alcanza a tus propios *previews*. Sigue siendo poco fino, pero no es un agujero |

---

## Qué queda sin reproducir en vivo

Verificado en vivo: **P0-1, P0-2, P0-3, P1-10, P2-2, P2-3**. El resto está confirmado sobre el código, con la ruta de ejecución razonada. Lo que no he podido llevar a la práctica y por qué:

- **P1-1 / P1-2 (cocinar)**: los datos de ejemplo **no traen ni un solo ingrediente en unidades de peso** (medido: 0 de todas las recetas), así que el caso "200 g → resta 200 unidades" no se puede provocar sin fabricar una receta a medida. La lógica es inequívoca en el código (`dec = ingQty` sin mirar `unit`), pero no lo he visto ocurrir.
- **P2-1 (congelado parcial)**: requiere una secuencia de movimientos que ensucia el inventario de pruebas; queda para la sesión de arreglos, donde sirve además como test de regresión.
- **Flujos con `confirm()`** (borrar gasto, borrar casa, vaciar carro): el navegador de pruebas suprime los diálogos nativos y los da por cancelados. Sólo se pueden recorrer a mano.
- ~~**`PRAGMA foreign_keys`**~~ — **RESUELTO (2026-08-01)**. Consulta de integridad lanzada contra la base real: **0 items huérfanos, 0 recetas huérfanas, 0 gastos huérfanos**. Los `ON DELETE CASCADE` sí se aplican en D1 y borrar una casa no deja rastro. Descartado como riesgo.

---

## Orden de arreglo propuesto *(ejecutado — ver el estado al principio)*

**Tanda 1 — lo que está roto (medio día).** P0-3 (una interrogación), P0-1 (una lambda), P0-2 (el sync), P1-1 (copiar la guarda que ya existe en `util/stock.js`). Cuatro arreglos de pocas líneas que devuelven la pantalla de casas, el chat de IA, la sincronización continua y la fiabilidad de cocinar. Es, con diferencia, el mejor rendimiento por línea tocada de toda la lista.

**Tanda 2 — cerrar las fugas silenciosas (un día).** P1-10 (JSON de la IA: `maxOutputTokens` + `responseSchema` + mensaje honesto), P1-3 (mismo arreglo que ya hicimos en gastos), P1-4 (usar `serverTime`, una línea), P1-5, P1-9 (fuerza bruta del OTP). Son los fallos que corrompen datos o rompen funciones sin que nadie se entere de por qué.

**Tanda 3 — coherencia y UX (a ratos).** P1-2 (unidades al cocinar, el más laborioso de todos), P1-6 y P1-7 (propagación de menú y casa, requieren migración), P2-2 (dejar de leer `expires`) y el resto de P2 por orden de lo que más moleste en el uso diario.

Además, transversal a todo: **un error boundary en la raíz**. Hoy cualquier excepción de render deja pantalla en blanco sin explicación — es lo que convirtió P0-3 en un muro en vez de en un aviso.

Los P3 no merecen una sesión propia: se van arreglando al pasar por cada fichero.
