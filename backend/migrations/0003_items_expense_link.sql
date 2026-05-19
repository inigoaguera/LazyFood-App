-- Vincula items a la compra (expense) que los introdujo en el inventario.
-- Permite cuadrar el ticket con la despensa: editar el item afecta al inventario
-- y al desglose de gastos a la vez.
--
-- Ejecutar con:
--   wrangler d1 execute lazyfood-db --file=./migrations/0003_items_expense_link.sql --remote

ALTER TABLE items ADD COLUMN expense_id TEXT;
ALTER TABLE items ADD COLUMN price REAL;
CREATE INDEX IF NOT EXISTS idx_items_expense ON items(expense_id);
