-- Elimina columnas que dejaron de usarse en shopping_list_items:
--   is_active: los productos de la lista siempre están activos; el concepto de
--              "pausar" un producto se descartó (ahora se elimina y se re-agrega).
--   notes:     se quitó la nota por producto de la UI.
alter table public.pantry_shopping_list_items
  drop column if exists is_active,
  drop column if exists notes;
