-- Elimina la columna `brand` de shopping_list_items.
-- Con el flujo search-first, la marca ya viene incluida en el nombre del
-- producto de Supermercado, así que dejó de ser un campo separado.
alter table public.pantry_shopping_list_items
  drop column if exists brand;
