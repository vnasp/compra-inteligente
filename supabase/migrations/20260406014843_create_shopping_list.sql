-- ─────────────────────────────────────────────────────────────────────────────
-- Tabla: shopping_list_items
-- Descripción: productos de la lista de compras habitual del usuario.
--   Un producto = una marca fija + un supermercado fijo.
--   El scraper actualizará `last_price` periódicamente.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.shopping_list_items (
  id            uuid primary key default gen_random_uuid(),

  -- Producto
  name          text        not null,                        -- ej: "Leche"
  brand         text        not null,                        -- ej: "Colun"
  category      text        not null,                        -- ej: "Lácteos"

  -- Cantidad habitual
  quantity      numeric(10,3) not null default 1,
  unit          text        not null default 'un',           -- 'un', 'kg', 'L', 'g', 'ml'

  -- Supermercado
  supermarket   text        not null default 'Lider',        -- único por ahora

  -- Precios (el scraper llenará estos campos)
  last_price    integer,                                     -- en pesos CLP, sin decimales
  price_updated_at timestamptz,

  -- Control
  is_active     boolean     not null default true,           -- false = pausado temporalmente
  notes         text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Índices útiles para filtrar
create index on public.shopping_list_items (category);
create index on public.shopping_list_items (supermarket);
create index on public.shopping_list_items (is_active);

-- Trigger para mantener updated_at automáticamente
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger shopping_list_items_updated_at
  before update on public.shopping_list_items
  for each row execute function public.set_updated_at();

-- RLS: solo el usuario autenticado dueño del registro puede ver/editar
-- (cuando agregues auth de usuario, añade user_id y ajusta las policies)
alter table public.shopping_list_items enable row level security;

-- Policy temporal: acceso abierto mientras no hay auth
-- REEMPLAZAR cuando se implemente login
create policy "allow_all_for_now"
  on public.shopping_list_items
  for all
  using (true)
  with check (true);
