# LazyFood 🥑

Tu despensa inteligente, en versión PWA. Frontend en React + Vite con almacenamiento en IndexedDB (Dexie). Las funciones de IA (chat de antojos, escáner de tickets, auto-planificador de menú) van contra Google Gemini 2.0 Flash a través de un proxy en Cloudflare Workers (la clave nunca sale del backend).

## Stack

- **Frontend**: React 18, Vite, `vite-plugin-pwa` (Workbox), Dexie.js, Dexie React Hooks
- **Backend**: Cloudflare Worker (`backend/src/index.js`) → Gemini 2.0 Flash
- **Persistencia**: IndexedDB (todo: items, recetas, lista, gastos, plan semanal, settings)
- **Sin**: localStorage para datos importantes, autenticación, server-side rendering, react-router

## Estructura

```
lazyfood/
├── index.html
├── vite.config.js
├── package.json
├── .env.example
├── public/
│   ├── manifest.json (lo genera vite-plugin-pwa)
│   └── icons/
│       ├── icon-192.png
│       ├── icon-512.png
│       └── icon-maskable.png
├── scripts/
│   └── gen-icons.js
├── src/
│   ├── main.jsx · App.jsx
│   ├── api.js · db.js
│   ├── tokens/ (palettes, fonts, categories)
│   ├── components/ (ctx, base)
│   ├── icons/LFIcon.jsx
│   └── screens/
│       ├── Onboarding.jsx
│       ├── Home.jsx
│       ├── Inventory.jsx
│       ├── AddEditItem.jsx
│       ├── Recipes.jsx · RecipeDetail.jsx
│       ├── AntojosChat.jsx
│       ├── Scanner.jsx
│       ├── Shopping.jsx · Expenses.jsx
│       ├── Menu.jsx
│       └── Profile.jsx
└── backend/
    ├── src/index.js
    ├── wrangler.toml
    └── package.json
```

## Configurar el frontend

```bash
cd lazyfood
npm install
cp .env.example .env
# Edita .env y pon la URL del worker que despliegues
npm run dev
```

Build para producción:

```bash
npm run build
npm run preview
```

Regenerar iconos PWA:

```bash
npm run icons
```

## Configurar el backend (Cloudflare Worker)

1. Instala Wrangler si no lo tienes ya: `npm i -g wrangler`
2. Entra al worker e inicia sesión:

   ```bash
   cd backend
   npm install
   wrangler login
   ```

3. Edita `wrangler.toml` (ajusta `name` a lo que quieras, p. ej. `lazyfood-api`).
4. Carga la API key de Gemini como secreto (no se versiona):

   ```bash
   npm run secret:gemini
   # pega tu GEMINI_API_KEY cuando te lo pida
   ```

5. (Opcional pero recomendado) Añade el origen de tu PWA a `ALLOWED_ORIGIN` en `wrangler.toml`:

   ```toml
   [vars]
   ALLOWED_ORIGIN = "https://tu-pwa.example.com"
   ```

6. Despliega:

   ```bash
   npm run deploy
   ```

   Wrangler te dará una URL `https://lazyfood-api.<tu-subdominio>.workers.dev`.

7. Pega esa URL en el `.env` del frontend:

   ```
   VITE_API_PROXY_URL=https://lazyfood-api.<tu-subdominio>.workers.dev
   ```

## Funcionalidades de IA

| Feature | Cómo se invoca | Modelo |
|---|---|---|
| Antojos chat (sugiere recetas con tu inventario) | Recetas → "¿Antojos?" | gemini-2.0-flash (texto) |
| Scanner de tickets de super | Botón central de la nav | gemini-2.0-flash (vision, `inlineData`) |
| Auto-planificar menú semanal | Menú → ✨ arriba | gemini-2.0-flash (texto) |

Todas devuelven JSON estructurado (`responseMimeType: 'application/json'`) y se parsean en `src/api.js`.

## Detalles de diseño

- 3 paletas (Huerto, Menta, Terracota) y 3 tipografías (Playful, Clean, Rounded). Default: **Huerto + Playful** (Fraunces + DM Sans). Se cambian desde Perfil y se persisten en IndexedDB.
- Soporte para safe-area iOS (`env(safe-area-inset-*)`).
- Animaciones `slideUp` y `fadeIn`, haptics vía `navigator.vibrate(10)`.
- Sin scroll horizontal del body (`overflow-x: hidden`).

## Consideraciones de seguridad

- La clave de Gemini **sólo** vive como secret en Cloudflare. El frontend manda peticiones al worker, nunca a Google directamente.
- El worker valida modelos permitidos y CORS. Recomienda ajustar `ALLOWED_ORIGIN` antes de exponer la PWA al público.

## Licencia

MIT — úsalo, fórketelo, modifícalo.
