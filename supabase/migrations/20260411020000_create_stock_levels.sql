-- ─────────────────────────────────────────────────────────────────────────────
-- Tabla: stock_levels
-- Descripción: nivel de stock actual en despensa para cada producto (0-100).
-- ─────────────────────────────────────────────────────────────────────────────

create table public.stock_levels (
  item_id     uuid primary key references public.shopping_list_items(id) on delete cascade,
  level       integer not null default 0 check (level >= 0 and level <= 100),
  updated_at  timestamptz not null default now()
);

create trigger stock_levels_updated_at
  before update on public.stock_levels
  for each row execute function public.set_updated_at();
