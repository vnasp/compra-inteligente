CREATE TABLE pantry_price_history (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     uuid        NOT NULL REFERENCES pantry_shopping_list_items(id) ON DELETE CASCADE,
  price       integer     NOT NULL,
  supermarket text        NOT NULL DEFAULT 'Jumbo',
  scraped_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_price_history_item_scraped
  ON pantry_price_history(item_id, scraped_at DESC);
