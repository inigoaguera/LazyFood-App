# LazyFood 🥑

Family PWA for managing the fridge, recipes, shopping list, and grocery expenses, with a handful of AI features on top (Gemini 2.5 Flash). Multi-household: each "house" is a group of people sharing fridge, recipes, and weekly meal plan.

Production app: https://lazyfood.pages.dev

## Stack

- **Frontend**: React 18, Vite, `vite-plugin-pwa` (Workbox), Dexie.js (IndexedDB) as local cache, inline CSS, no framework.
- **Backend**: Cloudflare Worker (`backend/src/index.js`) with **D1** (serverless SQLite) as source of truth.
- **Auth**: magic-link **+ 6-digit OTP** via Brevo (single-sender verified). JWT HS256 with dual storage (IndexedDB + localStorage) to survive iOS PWA storage eviction.
- **AI**: Google Gemini 2.5 Flash via the Worker (the API key never reaches the frontend).
- **Hosting**: Cloudflare Pages (frontend) + Workers (backend) + D1 (data).

## Data architecture

Cloud-first with local cache. **D1 is the source of truth**, IndexedDB is UI cache and settings.

All domain data is **scoped per household**. A user can belong to 0..N households. Main tables:

- `users`, `sessions`, `memberships`, `invites`, `auth_tokens` (magic + OTP)
- `households`
- `items` (inventory, with `expires_at` / `frozen_at` / `opened_at`)
- `recipes` + `recipe_details` (ingredients and steps as JSON)
- `shopping`, `expenses` (with `items_json` and `photo_url` reserved for R2)
- `menu_plan` (weekly planner)
- `categories` (12 defaults + custom per household)

Every mutation goes through the API; local cache refreshes on success. Delta sync (`?since=`) on focus.

## Structure

```
lazyfood/
├── index.html · vite.config.js · package.json · .env.example
├── public/icons/ (PWA icons)
├── scripts/gen-icons.js
├── src/
│   ├── main.jsx · App.jsx
│   ├── api/ (auth, sync, items, recipes, expenses, shopping, ai…)
│   ├── db.js (Dexie, schema v5)
│   ├── tokens/ (palettes, fonts, default categories)
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
    ├── wrangler.toml.example  (copy to wrangler.toml and fill in database_id)
    └── package.json
```

## Features

### Core
- **Inventory** with fractional quantities (0.25 cans, 0.5 eggs), custom categories, move between states (pantry, freezer, shopping list) via sheet.
- **Smart expiry**: `expires_at` (absolute) + `frozen_at` (pauses countdown) + `opened_at` (starts countdown for preserves).
- **Recipes** with a full editor, ingredients linkable to inventory items (fuzzy-match fallback), cleanup-effort tools (`tools`), 29 preset images.
- **Shopping list** with multipliers, swipe-delete, clear cart.
- **Expenses** with monthly calendar, manual editor, per-category breakdown chips.
- **Weekly menu** planned manually or by AI.
- **Multi-household**: create house, invite (short-token link), accept, remove members, delete, switch houses.

### AI (all via Worker → Gemini 2.5 Flash, structured JSON)

| Feature | How to trigger |
|---|---|
| Cravings chat (chat persisted per household) | Recipes → "¿Antojos?" |
| Inspírame (5 suggestions × 3 sections, with × to regenerate) | Recipes → Inspírame |
| Receipt scanner (vision, `inlineData`) | Center nav button |
| Auto-plan weekly menu | Menu → ✨ |
| Rescale servings (linear + AI) | Recipe → "Reajustar" |
| Use them now (saved recipes + AI for expiring item) | Tap on expiring item |

## Frontend setup

```bash
cd lazyfood
npm install
cp .env.example .env
# Edit .env and set the deployed Worker URL
npm run dev
```

Build and deploy:

```bash
npm run build
npx wrangler pages deploy dist --project-name lazyfood --branch=production
```

Regenerate PWA icons:

```bash
npm run icons
```

## Backend setup (Cloudflare Worker + D1)

1. Install Wrangler if you don't have it: `npm i -g wrangler`
2. Log in and prepare the worker:

   ```bash
   cd backend
   npm install
   wrangler login
   ```

3. Copy the config template:

   ```bash
   cp wrangler.toml.example wrangler.toml
   ```

4. Create the D1 database and paste the returned `database_id` into your `wrangler.toml`:

   ```bash
   wrangler d1 create lazyfood-db
   ```

5. Apply migrations (in order):

   ```bash
   wrangler d1 execute lazyfood-db --file=./migrations/0001_initial.sql --remote
   # …and the rest of migrations/*.sql
   ```

6. Load the secrets (not versioned):

   ```bash
   wrangler secret put GEMINI_API_KEY         # Google AI Studio API key
   wrangler secret put JWT_SECRET             # 32+ bytes random base64
   wrangler secret put BREVO_API_KEY          # xkeysib-... from brevo.com
   wrangler secret put RESEND_FROM_EMAIL      # Brevo-verified email (single sender)
   ```

7. Adjust `ALLOWED_ORIGIN` and `APP_URL` in `wrangler.toml` to your real PWA domain.

8. Deploy:

   ```bash
   wrangler deploy
   ```

9. Paste the Worker URL into the frontend `.env`:

   ```
   VITE_API_PROXY_URL=https://lazyfood-api.<your-subdomain>.workers.dev
   ```

## Auth: why OTP on top of magic link

Magic links on iOS **always open in Safari**, never in the standalone PWA. That breaks the session: the JWT lands in Safari's storage, not in the installed app's. To work around this, the email also includes a **6-digit code** the user types inside the PWA → session is saved in the correct context.

JWT is stored in IndexedDB **and** localStorage as a fallback, because iOS aggressively evicts PWA storage.

## Design

- 3 palettes (Huerto, Menta, Terracota) × 3 typefaces (Playful, Clean, Rounded). Default: **Huerto + Playful** (Fraunces + DM Sans). Switchable from Profile.
- iOS safe-area (`env(safe-area-inset-*)`), `slideUp`/`fadeIn` animations, haptics (`navigator.vibrate(10)`).

## Debug

- `?debug=1` enables a persistent overlay.
- Gesture: 7 taps on the avocado → toggle overlay.
- [Eruda](https://github.com/liriliri/eruda) embedded for a mobile console when the overlay is on.

## Security

- Gemini API key, JWT secret, and Brevo API key live **only** as Wrangler secrets.
- The Worker validates CORS against `ALLOWED_ORIGIN`, validates allowed models, and signs/verifies HS256 JWTs.
- The frontend never calls Google/Brevo directly.

## Known pending work

- Receipt photo upload to R2 (the `photo_url` column already exists).
- Promote a member to owner.
- UI to revoke invitations/sessions.
- Push notifications for expiring items.
- Semantic tags on recipes (vegetarian, light, gluten-free, time of day).

## License

MIT — use it, fork it, modify it.
