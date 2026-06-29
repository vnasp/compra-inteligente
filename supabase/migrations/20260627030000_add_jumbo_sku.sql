-- ─────────────────────────────────────────────────────────────────────────────
-- Vínculo de cada producto con su equivalente en Jumbo (VTEX).
-- jumbo_sku: skuId de VTEX, usado para armar el deep link de carrito
--   (/checkout/cart/add?sku=...). jumbo_name: nombre del producto en Jumbo,
--   para mostrar el vínculo confirmado en la UI.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.pantry_shopping_list_items
  add column jumbo_sku  text,
  add column jumbo_name text;
