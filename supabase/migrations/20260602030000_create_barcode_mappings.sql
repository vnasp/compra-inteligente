create table pantry_barcode_mappings (
  barcode     text        primary key,
  item_id     uuid        not null references pantry_shopping_list_items(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index idx_barcode_mappings_item_id on pantry_barcode_mappings (item_id);

alter table pantry_barcode_mappings enable row level security;
create policy "allow_all_barcode_mappings" on pantry_barcode_mappings
  for all using (true) with check (true);
