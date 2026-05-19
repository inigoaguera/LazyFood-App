-- Categorías personalizadas por casa.
-- Las categorías por defecto (lacteo, verdura, fruta, carne, pescado, pasta,
-- conserva, salsa, especia, bebida, snack, congelado) viven en el frontend.
-- Esta tabla añade categorías extra creadas por el usuario.
--
-- Ejecutar:
--   wrangler d1 execute lazyfood-db --file=./migrations/0007_custom_categories.sql --remote

CREATE TABLE IF NOT EXISTS categories (
  id           TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  color        TEXT,
  emoji        TEXT,
  updated_at   INTEGER NOT NULL,
  deleted_at   INTEGER
);
CREATE INDEX IF NOT EXISTS idx_categories_h ON categories(household_id, updated_at);
