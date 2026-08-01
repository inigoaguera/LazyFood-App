-- menu_plan era la única tabla de datos sin deleted_at, y desasignar un slot
-- hacía un DELETE duro. El delta sync sólo sabe traer filas con updated_at
-- mayor que la marca de agua: una fila borrada ya no existe, así que el hueco
-- no llegaba nunca a los demás móviles. En el otro móvil la receta seguía
-- puesta en la cena del jueves hasta un sync completo.
--
-- Ejecutar con:
--   wrangler d1 execute lazyfood-db --file=./migrations/0010_menu_plan_soft_delete.sql --remote

ALTER TABLE menu_plan ADD COLUMN deleted_at INTEGER;
