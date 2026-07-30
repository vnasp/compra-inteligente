-- ─────────────────────────────────────────────────────────────────────────────
-- Vínculo de cada producto con su equivalente en Supermercado (VTEX).
-- jumbo_sku: skuId de VTEX, usado para armar el deep link de carrito
--   (/checkout/cart/add?sku=...). jumbo_name: nombre del producto en Supermercado,
--   para mostrar el vínculo confirmado en la UI.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.pantry_shopping_list_items
  add column jumbo_sku  text,
  add column jumbo_name text;
