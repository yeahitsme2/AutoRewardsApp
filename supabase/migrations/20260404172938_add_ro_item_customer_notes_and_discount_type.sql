/*
  # Add customer_notes to repair_order_items and discount item type

  ## Changes

  1. New column
    - `repair_order_items.customer_notes` (text, nullable): Admin-authored notes visible to the customer on their RO view.

  2. Schema update
    - Extends the `item_type` check constraint on `repair_order_items` to include 'discount' as a valid type.
    - Discounts are treated as negative fees in total calculations.

  ## Notes
  - The column is nullable; existing rows remain unaffected.
  - The constraint change is additive and non-destructive.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'repair_order_items' AND column_name = 'customer_notes'
  ) THEN
    ALTER TABLE repair_order_items ADD COLUMN customer_notes text;
  END IF;
END $$;

ALTER TABLE repair_order_items
  DROP CONSTRAINT IF EXISTS repair_order_items_item_type_check;

ALTER TABLE repair_order_items
  ADD CONSTRAINT repair_order_items_item_type_check
  CHECK (item_type IN ('labor', 'part', 'fee', 'discount'));
