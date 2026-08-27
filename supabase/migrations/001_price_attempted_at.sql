-- Registra cuándo se intentó scrapear el precio de un producto, haya o no
-- resultado. Sin esto, un producto que el supermercado nunca matchea queda
-- eternamente "con precio vencido" y bloquea el paso a optimizar.
alter table public.pantry_shopping_list_items
  add column if not exists price_attempted_at timestamptz;

-- Un precio ya guardado implica que hubo un intento exitoso en ese momento,
-- así que la primera corrida tras la migración no re-scrapea toda la lista.
update public.pantry_shopping_list_items
   set price_attempted_at = price_updated_at
 where price_attempted_at is null
   and price_updated_at is not null;
