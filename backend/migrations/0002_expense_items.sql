-- Añadir columnas para guardar items de la compra y URL de foto del ticket.
-- Ejecutar con:
--   wrangler d1 execute lazyfood-db --file=./migrations/0002_expense_items.sql --remote

ALTER TABLE expenses ADD COLUMN items_json TEXT;
ALTER TABLE expenses ADD COLUMN photo_url TEXT;
