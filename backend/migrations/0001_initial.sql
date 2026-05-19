-- LazyFood — schema inicial. Ejecutar con:
--   wrangler d1 execute lazyfood-db --file=./migrations/0001_initial.sql --remote

PRAGMA foreign_keys = ON;

-- ─── Identidad ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  name        TEXT,
  avatar      TEXT,
  prefs_json  TEXT,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_tokens (
  token       TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  expires_at  INTEGER NOT NULL,
  used_at     INTEGER
);
CREATE INDEX IF NOT EXISTS idx_auth_email ON auth_tokens(email);
CREATE INDEX IF NOT EXISTS idx_auth_expires ON auth_tokens(expires_at);

CREATE TABLE IF NOT EXISTS sessions (
  jti         TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  issued_at   INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- ─── Casas ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS households (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#4A7C3A',
  budget      REAL,
  onboarded   INTEGER NOT NULL DEFAULT 0,
  created_by  TEXT NOT NULL REFERENCES users(id),
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS memberships (
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'member',
  joined_at    INTEGER NOT NULL,
  PRIMARY KEY (household_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_mem_user ON memberships(user_id);

CREATE TABLE IF NOT EXISTS invites (
  token        TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  created_by   TEXT NOT NULL REFERENCES users(id),
  expires_at   INTEGER NOT NULL,
  max_uses     INTEGER NOT NULL DEFAULT 5,
  used_count   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_invites_h ON invites(household_id);

-- ─── Datos por casa ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS items (
  id           TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT, emoji TEXT, cat TEXT, loc TEXT, type TEXT,
  qty REAL, fill REAL, unit TEXT, expires INTEGER,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_items_h ON items(household_id, updated_at);

CREATE TABLE IF NOT EXISTS recipes (
  id           TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT, time INTEGER, effort INTEGER, missing INTEGER,
  missing_item TEXT, img TEXT, "group" TEXT, author TEXT,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_recipes_h ON recipes(household_id, updated_at);

CREATE TABLE IF NOT EXISTS shopping (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT, qty TEXT, cat TEXT, checked INTEGER, auto INTEGER,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_shopping_h ON shopping(household_id, updated_at);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  date TEXT, amount REAL, cat TEXT, store TEXT, saved_on_discounts REAL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_expenses_h ON expenses(household_id, updated_at);

CREATE TABLE IF NOT EXISTS menu_plan (
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  slot         TEXT NOT NULL,
  recipe_id    TEXT NOT NULL,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (household_id, slot)
);

CREATE TABLE IF NOT EXISTS recipe_details (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  match_name TEXT, name TEXT, time INTEGER, effort INTEGER, servings INTEGER,
  img TEXT, "desc" TEXT,
  ingredients_json TEXT,
  steps_json TEXT,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_rdet_h ON recipe_details(household_id, updated_at);
