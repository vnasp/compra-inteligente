-- ─────────────────────────────────────────────────────────────────────────────
-- Última lista óptima lista para el carro del supermercado.
--
-- El carro solo se puede llenar desde el sitio del supermercado (su BFF acepta
-- llamadas únicamente desde su propio origen), así que un bookmarklet corre
-- allá y consulta esta lista vía /api/cart-list. Guardarla aquí es lo que
-- permite que el marcador sea permanente: se crea una vez y siempre lee la
-- lista vigente, sin volver a pegar código.
--
-- Se conserva un solo registro (el más reciente); es una foto, no un historial.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.pantry_cart_snapshot (
  id         uuid        primary key default gen_random_uuid(),
  -- [{"skuId": "5867", "quantity": 2}, …]
  items      jsonb       not null,
  created_at timestamptz not null default now()
);

alter table public.pantry_cart_snapshot enable row level security;
create policy "allow_all_cart_snapshot" on public.pantry_cart_snapshot
  for all using (true) with check (true);
