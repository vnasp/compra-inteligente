-- ─────────────────────────────────────────────────────────────────────────────
-- Reemplaza la configuración de frecuencia (mensual/quincenal + día de la
-- semana) por fechas de compra marcadas explícitamente en el calendario.
--
-- Antes: shopping_days (días del mes de referencia, ej. {1,15}) +
--        shopping_weekday (día de la semana al que se ajustaba la fecha).
-- Ahora: shopping_dates (fechas exactas que el usuario marca en el calendario).
--        La próxima compra es la primera fecha marcada >= hoy, y el inicio del
--        ciclo se deriva de la primera fecha marcada del mes en curso.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.pantry_user_config
  add column if not exists shopping_dates date[] not null default '{}';

alter table public.pantry_user_config
  drop column if exists shopping_days;

alter table public.pantry_user_config
  drop column if exists shopping_weekday;
