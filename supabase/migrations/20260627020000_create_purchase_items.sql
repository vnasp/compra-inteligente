-- ─────────────────────────────────────────────────────────────────────────────
-- Tabla: pantry_purchase_items
-- Descripción: registro de unidades compradas por producto dentro de un ciclo.
--   Permite no volver a sugerir un producto cuya cantidad mensual ya se compró
--   (ej. galletas 2/mes ya compradas → no sugerir en la quincena).
--   Se alimenta del flujo "Marcar como comprado" de la optimización.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.pantry_purchase_items (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references public.pantry_shopping_list_items(id) on delete cascade,
  quantity     numeric(10,3) not null,
  purchased_at date not null default current_date,
  created_at   timestamptz not null default now()
);

-- Índice para filtrar por ciclo
create index idx_purchase_items_purchased_at
  on public.pantry_purchase_items (purchased_at);

create index idx_purchase_items_item_id
  on public.pantry_purchase_items (item_id);

-- RLS abierto (sin auth por ahora), consistente con las demás tablas pantry_*
alter table public.pantry_purchase_items enable row level security;
create policy "allow_all_purchase_items" on public.pantry_purchase_items
  for all using (true) with check (true);
