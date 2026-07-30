-- ─────────────────────────────────────────────────────────────────────────────
-- Elimina el soporte de subida de boletas.
-- La app ya no parsea PDFs de boleta ni mapea códigos de barra a productos:
-- el gasto se registra manualmente o como estimación al marcar como comprado.
-- ─────────────────────────────────────────────────────────────────────────────

drop table if exists public.pantry_barcode_mappings;
