/*
  # Link Repair Order Items to Inventory Parts

  ## Summary
  This migration adds inventory awareness to repair order line items, enabling the parts picker
  to connect RO line items directly to the parts catalog. It also adds a cost snapshot field
  so we preserve what the part cost was at the time the RO was created.

  ## Changes

  ### Modified Tables

  #### repair_order_items
  - `part_id` (uuid, nullable) - FK to parts table. Null for free-text or labor/fee items.
  - `part_cost_snapshot` (numeric 10,2, nullable) - The unit_cost of the part at time of RO creation.
    This freezes the cost for historical accuracy even if inventory prices change later.

  ## Notes
  - Both columns are nullable for full backward compatibility with existing RO items
  - part_id has a foreign key to parts but ON DELETE SET NULL so deleting a part doesn't break ROs
  - An index is added on repair_order_items(part_id) for efficient lookups
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'repair_order_items' AND column_name = 'part_id'
  ) THEN
    ALTER TABLE repair_order_items
      ADD COLUMN part_id uuid REFERENCES parts(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'repair_order_items' AND column_name = 'part_cost_snapshot'
  ) THEN
    ALTER TABLE repair_order_items
      ADD COLUMN part_cost_snapshot numeric(10, 2);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_repair_order_items_part_id
  ON repair_order_items (part_id)
  WHERE part_id IS NOT NULL;
