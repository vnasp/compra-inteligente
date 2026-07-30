-- ─────────────────────────────────────────────────────────────────────────────
-- Agrega cycle_start a pantry_user_config.
-- Marca el inicio del ciclo de compra activo. Cuando se "cierra el mes" se
-- actualiza a la fecha de hoy, reiniciando presupuesto y contadores de comprado.
-- Si es null, la app calcula el inicio del ciclo automáticamente.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.pantry_user_config
  add column cycle_start date;
