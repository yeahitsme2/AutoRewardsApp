/*
  # Add parent item nesting + labor hours to repair order items
*/

ALTER TABLE repair_order_items
  ADD COLUMN IF NOT EXISTS parent_item_id uuid REFERENCES repair_order_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS labor_hours numeric;

CREATE INDEX IF NOT EXISTS idx_ro_items_parent
  ON repair_order_items (parent_item_id);
