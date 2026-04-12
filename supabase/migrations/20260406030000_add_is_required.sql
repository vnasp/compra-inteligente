-- Agrega campo is_required para distinguir productos obligatorios de opcionales
-- Default true: todos los existentes se asumen requeridos
ALTER TABLE shopping_list_items
  ADD COLUMN is_required boolean NOT NULL DEFAULT true;
