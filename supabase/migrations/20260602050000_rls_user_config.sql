alter table public.pantry_user_config enable row level security;

create policy "allow_all_user_config" on public.pantry_user_config
  for all using (true) with check (true);
