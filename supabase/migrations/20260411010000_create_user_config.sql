-- ─────────────────────────────────────────────────────────────────────────────
-- Tabla: user_config
-- Descripción: configuración mensual del usuario (presupuesto, fechas de
--   compra y supermercados a comparar).
--   Se espera un solo registro por usuario; por ahora, un registro global.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.user_config (
  id              uuid primary key default gen_random_uuid(),

  -- Presupuesto
  monthly_budget  integer not null default 150000,           -- CLP

  -- Fechas de compra planificadas (array de días del mes, ej. [1, 15])
  shopping_days   integer[] not null default '{1}',

  -- Supermercados a comparar
  supermarkets    text[] not null default '{"Lider"}',

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Trigger para mantener updated_at automáticamente
create trigger user_config_updated_at
  before update on public.user_config
  for each row execute function public.set_updated_at();

-- Insertar configuración por defecto
insert into public.user_config (monthly_budget, shopping_days, supermarkets)
values (150000, '{1, 15}', '{"Lider", "Jumbo"}');
