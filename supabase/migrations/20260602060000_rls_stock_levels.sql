alter table public.pantry_stock_levels enable row level security;

create policy "allow_all_stock_levels" on public.pantry_stock_levels
  for all using (true) with check (true);
