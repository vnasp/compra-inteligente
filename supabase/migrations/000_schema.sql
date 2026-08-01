-- Consolidated schema for Compra Inteligente.
-- This file represents the final schema expected by the application.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- Shared trigger for updated_at columns.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Shopping list items.
create table public.pantry_shopping_list_items (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  category         text not null,
  quantity         numeric(10, 3) not null default 1,
  unit             text not null default 'un',
  package_size     numeric(10, 3),
  package_unit     text,
  last_price       integer,
  price_updated_at timestamptz,
  jumbo_sku        text,
  jumbo_name       text,
  is_required      boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_shopping_list_items_category
  on public.pantry_shopping_list_items (category);

create trigger pantry_shopping_list_items_updated_at
  before update on public.pantry_shopping_list_items
  for each row execute function public.set_updated_at();

alter table public.pantry_shopping_list_items enable row level security;
create policy "allow_all_shopping_list_items"
  on public.pantry_shopping_list_items
  for all using (true) with check (true);

-- User configuration. There is one global row while the app has no auth.
create table public.pantry_user_config (
  id             uuid primary key default gen_random_uuid(),
  monthly_budget integer not null default 150000,
  shopping_dates date[] not null default '{}',
  supermarkets   text[] not null default '{"Supermercado"}',
  cycle_start    date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger pantry_user_config_updated_at
  before update on public.pantry_user_config
  for each row execute function public.set_updated_at();

alter table public.pantry_user_config enable row level security;
create policy "allow_all_user_config"
  on public.pantry_user_config
  for all using (true) with check (true);

insert into public.pantry_user_config (
  monthly_budget,
  shopping_dates,
  supermarkets
)
values (
  150000,
  array[]::date[],
  array['Supermercado']
);

-- Current pantry stock in the same unit as pantry_shopping_list_items.quantity.
create table public.pantry_stock_levels (
  item_id    uuid primary key references public.pantry_shopping_list_items(id) on delete cascade,
  remaining  numeric(10, 3) not null default 0,
  updated_at timestamptz not null default now()
);

create trigger pantry_stock_levels_updated_at
  before update on public.pantry_stock_levels
  for each row execute function public.set_updated_at();

alter table public.pantry_stock_levels enable row level security;
create policy "allow_all_stock_levels"
  on public.pantry_stock_levels
  for all using (true) with check (true);

-- Manual or estimated purchases used by budget/history.
create table public.pantry_purchases (
  id           uuid primary key default gen_random_uuid(),
  amount       integer not null,
  supermarket  text not null default '',
  purchased_at date not null default current_date,
  tag          text,
  created_at   timestamptz not null default now()
);

create index idx_purchases_purchased_at
  on public.pantry_purchases (purchased_at);

alter table public.pantry_purchases enable row level security;
create policy "allow_all_purchases"
  on public.pantry_purchases
  for all using (true) with check (true);

-- Price history captured by scraping.
create table public.pantry_price_history (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references public.pantry_shopping_list_items(id) on delete cascade,
  price       integer not null,
  supermarket text not null default 'Supermercado',
  scraped_at  timestamptz not null default now()
);

create index idx_price_history_item_scraped
  on public.pantry_price_history (item_id, scraped_at desc);

alter table public.pantry_price_history enable row level security;
create policy "allow_all_price_history"
  on public.pantry_price_history
  for all using (true) with check (true);

-- Purchased units per item in the current cycle.
create table public.pantry_purchase_items (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references public.pantry_shopping_list_items(id) on delete cascade,
  quantity     numeric(10, 3) not null,
  purchased_at date not null default current_date,
  created_at   timestamptz not null default now()
);

create index idx_purchase_items_purchased_at
  on public.pantry_purchase_items (purchased_at);

create index idx_purchase_items_item_id
  on public.pantry_purchase_items (item_id);

alter table public.pantry_purchase_items enable row level security;
create policy "allow_all_purchase_items"
  on public.pantry_purchase_items
  for all using (true) with check (true);

-- Latest optimized cart snapshot read by the Jumbo bookmarklet.
create table public.pantry_cart_snapshot (
  id         uuid primary key default gen_random_uuid(),
  items      jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.pantry_cart_snapshot enable row level security;
create policy "allow_all_cart_snapshot"
  on public.pantry_cart_snapshot
  for all using (true) with check (true);
