-- Tabla de compras realizadas
create table pantry_purchases (
  id uuid primary key default gen_random_uuid(),
  amount integer not null,
  supermarket text not null default '',
  purchased_at date not null default current_date,
  tag text,
  created_at timestamptz not null default now()
);

-- Índice para filtrar por mes
create index idx_purchases_purchased_at on pantry_purchases (purchased_at);

-- RLS abierto (sin auth por ahora)
alter table pantry_purchases enable row level security;
create policy "allow_all_purchases" on pantry_purchases for all using (true) with check (true);
