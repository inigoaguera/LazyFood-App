-- Rediseño de caducidad: pasamos de "días restantes (estático)" a fecha absoluta.
-- expires_at: timestamp ms cuando caduca el item. NULL = sin caducidad.
-- frozen_at:  timestamp ms cuando se congeló. NULL = no congelado.
--             Mientras esté congelado, los días restantes no avanzan.
-- opened_at:  timestamp ms cuando el usuario tocó "Abrir". Útil para conservas
--             que llegaron sin caducidad y empiezan a contar al abrirse.

ALTER TABLE items ADD COLUMN expires_at INTEGER;
ALTER TABLE items ADD COLUMN frozen_at INTEGER;
ALTER TABLE items ADD COLUMN opened_at INTEGER;

-- Backfill: para items existentes con expires en días, calculamos la fecha absoluta
-- a partir de updated_at. Items con expires NULL o 0 quedan como sin caducidad.
UPDATE items
SET expires_at = COALESCE(updated_at, strftime('%s','now') * 1000) + expires * 86400000
WHERE expires IS NOT NULL AND expires > 0 AND expires_at IS NULL;
