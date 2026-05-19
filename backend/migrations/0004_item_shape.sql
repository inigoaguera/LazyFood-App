-- Añade la "forma" del recipiente para items de tipo continuous
-- (bottle = botella/garrafa, jar = tarro/lata grande, sack = saco/bolsa).
-- Para items discretos, este campo no aplica (queda null).
--
-- Ejecutar con:
--   wrangler d1 execute lazyfood-db --file=./migrations/0004_item_shape.sql --remote

ALTER TABLE items ADD COLUMN shape TEXT;
