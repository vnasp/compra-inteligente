-- Agrega campos de tamaño de envase a shopping_list_items
-- package_size: tamaño numérico del envase (ej. 850 para "850 g")
-- package_unit: unidad del tamaño del envase (ej. "g", "ml", "kg")

ALTER TABLE public.shopping_list_items
  ADD COLUMN IF NOT EXISTS package_size  numeric(10, 3) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS package_unit  text           DEFAULT NULL;
