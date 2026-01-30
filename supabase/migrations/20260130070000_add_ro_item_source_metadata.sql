/*
  # Add source metadata for repair order items (DVI import)
*/

ALTER TABLE repair_order_items
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_id text,
  ADD COLUMN IF NOT EXISTS metadata jsonb;

CREATE INDEX IF NOT EXISTS idx_ro_items_source
  ON repair_order_items (repair_order_id, source_type, source_id);
