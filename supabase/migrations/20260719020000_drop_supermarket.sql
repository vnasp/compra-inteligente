-- Elimina la columna `supermarket` de shopping_list_items.
-- La app opera solo con Supermercado, así que el supermercado por producto dejó de
-- tener sentido (siempre era "Supermercado" y nunca se mostraba).
-- Nota: NO afecta a pantry_purchases.supermarket ni a
-- pantry_price_history.supermarket, que son columnas distintas y sí se usan.
alter table public.pantry_shopping_list_items
  drop column if exists supermarket;
