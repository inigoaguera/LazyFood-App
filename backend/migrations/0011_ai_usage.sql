-- Contador diario de llamadas a /ai por usuario.
-- Sin esto, la única protección de la cuota de Gemini era estar logueado: un
-- bucle accidental o un móvil robado podía agotarla sin que nada lo frenara.
--
-- Ejecutar con:
--   wrangler d1 execute lazyfood-db --file=./migrations/0011_ai_usage.sql --remote

CREATE TABLE IF NOT EXISTS ai_usage (
  user_id TEXT NOT NULL,
  day     TEXT NOT NULL,            -- 'YYYY-MM-DD' en UTC
  count   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
