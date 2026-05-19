-- Multiplicador para items de la lista de la compra (x2, x3...)
ALTER TABLE shopping ADD COLUMN count INTEGER NOT NULL DEFAULT 1;

-- Instrumentos que se manchan al cocinar una receta (sartén, batidora...)
ALTER TABLE recipe_details ADD COLUMN tools_json TEXT;
