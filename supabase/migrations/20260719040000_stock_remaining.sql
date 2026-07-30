-- Cambia el modelo de stock de "nivel %" (0-100) a "cantidad restante" en las
-- mismas unidades que shopping_list_items.quantity.
-- Los valores antiguos (porcentajes) no se traducen a cantidades, se limpian.
delete from public.pantry_stock_levels;

alter table public.pantry_stock_levels
  drop constraint if exists stock_levels_level_check;

alter table public.pantry_stock_levels
  alter column level drop default;

alter table public.pantry_stock_levels
  alter column level type numeric(10, 3) using level::numeric;

alter table public.pantry_stock_levels
  alter column level set default 0;

alter table public.pantry_stock_levels
  rename column level to remaining;
