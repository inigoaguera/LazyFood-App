# LazyFood 🥑

PWA familiar para gestionar la nevera, recetas, lista de la compra y gastos del super, con un puñado de funciones de IA encima (Gemini 2.5 Flash). Multi-hogar: cada "casa" es un grupo de personas que comparten nevera, recetas y plan semanal.

App en producción: https://lazyfood.pages.dev

## Stack

- **Frontend**: React 18, Vite, `vite-plugin-pwa` (Workbox), Dexie.js (IndexedDB) como cache local, CSS inline sin framework.
- **Backend**: Cloudflare Worker (`backend/src/index.js`) con **D1** (SQLite serverless) como fuente de verdad.
- **Auth**: magic-link **+ OTP de 6 dígitos** vía Brevo (sender single-verified). JWT HS256 con doble storage (IndexedDB + localStorage) para sobrevivir el reciclado de almacenamiento de iOS PWA.
- **IA**: Google Gemini 2.5 Flash a través del Worker (la API key nunca toca el frontend).
- **Hosting**: Cloudflare Pages (frontend) + Workers (backend) + D1 (datos).

## Arquitectura de datos

Cloud-first con cache local. **D1 es la fuente de verdad**, IndexedDB es cache de UI y settings.

Todos los datos de dominio están **scoped por household** (casa). Un usuario puede pertenecer a 0..N casas. Tablas principales:

- `users`, `sessions`, `memberships`, `invites`, `auth_tokens` (magic + OTP)
- `households`
- `items` (inventario, con `expires_at` / `frozen_at` / `opened_at`)
- `recipes` + `recipe_details` (ingredientes y pasos en JSON)
- `shopping`, `expenses` (con `items_json` y `photo_url` reservado para R2)
- `menu_plan` (planificador semanal)
- `categories` (12 defaults + custom por casa)

Toda mutación pasa por la API; la cache local se refresca tras éxito. Sync por deltas (`?since=`) en focus.

## Estructura

```
lazyfood/
├── index.html · vite.config.js · package.json · .env.example
├── public/icons/ (PWA icons)
├── scripts/gen-icons.js
├── src/
│   ├── main.jsx · App.jsx
│   ├── api/ (auth, sync, items, recipes, expenses, shopping, ai…)
│   ├── db.js (Dexie, esquema v5)
│   ├── tokens/ (palettes, fonts, categories defaults)
│   ├── components/ (ctx, base, sheets…)
│   ├── icons/LFIcon.jsx
│   ├── util/ (expires, fractions, useCategories…)
│   └── screens/
│       ├── Login.jsx · Onboarding.jsx
│       ├── Home.jsx · Inventory.jsx · AddEditItem.jsx
│       ├── Recipes.jsx · RecipeDetail.jsx · RecipeEditor.jsx
│       ├── AntojosChat.jsx · Inspirame.jsx
│       ├── Scanner.jsx · Shopping.jsx · Expenses.jsx
│       ├── Menu.jsx · Profile.jsx · Household.jsx
└── backend/
    ├── src/index.js (router + handlers)
    ├── migrations/00XX_*.sql
    ├── wrangler.toml.example  (copia a wrangler.toml y rellena database_id)
    └── package.json
```

## Funcionalidades

### Core
- **Inventario** con cantidades fraccionarias (0.25 latas, 0.5 huevos), categorías custom, mover entre estados (despensa, congelador, lista compra) con sheet.
- **Caducidad inteligente**: `expires_at` (absoluto) + `frozen_at` (pausa contador) + `opened_at` (arranca contador en conservas).
- **Recetas** con editor completo, ingredientes vinculables a items del inventario (fallback a fuzzy-match), instrumentos a fregar (`tools`), 29 imágenes preset.
- **Lista de la compra** con multiplicadores, swipe-eliminar, vaciar carro.
- **Gastos** con calendario mensual, editor manual, chips de breakdown por categoría.
- **Menú semanal** planificable a mano o por IA.
- **Multi-hogar**: crear casa, invitar (link con token corto), aceptar, expulsar, borrar, cambiar de casa.

### IA (todas vía Worker → Gemini 2.5 Flash, JSON estructurado)

| Feature | Cómo se invoca |
|---|---|
| Antojos chat (chat persistido por casa) | Recetas → "¿Antojos?" |
| Inspírame (5 sugerencias × 3 secciones, con × para regenerar) | Recetas → Inspírame |
| Scanner de tickets (visión, `inlineData`) | Botón central de la nav |
| Auto-planificar menú semanal | Menú → ✨ |
| Reajustar raciones (escalado lineal + IA) | Receta → "Reajustar" |
| Úsalos ya (recetas guardadas + IA con ítem caducando) | Tap en item caducando |

## Configurar el frontend

```bash
cd lazyfood
npm install
cp .env.example .env
# Edita .env y pon la URL del Worker desplegado
npm run dev
```

Build y deploy:

```bash
npm run build
npx wrangler pages deploy dist --project-name lazyfood --branch=production
```

Regenerar iconos PWA:

```bash
npm run icons
```

## Configurar el backend (Cloudflare Worker + D1)

1. Instala Wrangler si no lo tienes: `npm i -g wrangler`
2. Login y prepara el worker:

   ```bash
   cd backend
   npm install
   wrangler login
   ```

3. Copia el template de configuración:

   ```bash
   cp wrangler.toml.example wrangler.toml
   ```

4. Crea la base de datos D1 y pega el `database_id` que devuelve en tu `wrangler.toml`:

   ```bash
   wrangler d1 create lazyfood-db
   ```

5. Aplica las migraciones (en orden):

   ```bash
   wrangler d1 execute lazyfood-db --file=./migrations/0001_initial.sql --remote
   # …y el resto de migrations/*.sql
   ```

6. Carga los secrets (no se versionan):

   ```bash
   wrangler secret put GEMINI_API_KEY         # API key de Google AI Studio
   wrangler secret put JWT_SECRET             # 32+ bytes random base64
   wrangler secret put BREVO_API_KEY          # xkeysib-... de brevo.com
   wrangler secret put RESEND_FROM_EMAIL      # email verificado en Brevo (single sender)
   ```

7. Ajusta `ALLOWED_ORIGIN` y `APP_URL` en `wrangler.toml` al dominio real de tu PWA.

8. Despliega:

   ```bash
   wrangler deploy
   ```

9. Pega la URL del Worker en el `.env` del frontend:

   ```
   VITE_API_PROXY_URL=https://lazyfood-api.<tu-subdominio>.workers.dev
   ```

## Auth: por qué OTP además de magic link

Los magic links en iOS abren **siempre en Safari**, nunca en la PWA standalone. Eso rompe la sesión: el JWT se guarda en el storage de Safari, no en el de la app instalada. Para evitarlo, el email incluye además un **código de 6 dígitos** que el usuario teclea dentro de la PWA → la sesión queda guardada en el contexto correcto.

JWT se guarda en IndexedDB **y** en localStorage como fallback, porque iOS recicla agresivamente el storage de las PWAs.

## Diseño

- 3 paletas (Huerto, Menta, Terracota) × 3 tipografías (Playful, Clean, Rounded). Default: **Huerto + Playful** (Fraunces + DM Sans). Se cambian desde Perfil.
- Safe-area iOS (`env(safe-area-inset-*)`), animaciones `slideUp`/`fadeIn`, haptics (`navigator.vibrate(10)`).

## Debug

- `?debug=1` activa overlay persistente.
- Gesto: 7 toques sobre el aguacate → toggle overlay.
- [Eruda](https://github.com/liriliri/eruda) embebido para consola en móvil cuando el overlay está activo.

## Seguridad

- API key de Gemini, JWT secret y API key de Brevo viven **sólo** como Wrangler secrets.
- El Worker valida CORS contra `ALLOWED_ORIGIN`, valida modelos permitidos y firma/verifica JWTs HS256.
- El frontend nunca llama a Google/Brevo directamente.

## Pendientes conocidos

- Subida de foto de ticket a R2 (la columna `photo_url` ya existe).
- Promover miembro de casa a owner.
- UI para revocar invitaciones/sesiones.
- Push notifications de caducidad.
- Tags semánticos en recetas (vegetariano, ligero, sin gluten, momento del día).

## Licencia

MIT — úsalo, fórketelo, modifícalo.
