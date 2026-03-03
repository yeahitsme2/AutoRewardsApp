/*
  # Fix Repair Order Items Cascade Delete

  1. Changes
    - Drop old foreign key constraint with ON DELETE SET NULL
    - Ensure parent_item_id uses ON DELETE CASCADE for proper cleanup
    - This fixes the "socket hang up" error when deleting items

  2. Security
    - No RLS changes needed
*/

-- First, check if the old constraint exists and drop it
DO $$
BEGIN
  -- Drop the old constraint if it exists (from migration 20260130080000)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'repair_order_items_parent_item_id_fkey'
      AND table_name = 'repair_order_items'
  ) THEN
    ALTER TABLE repair_order_items
      DROP CONSTRAINT repair_order_items_parent_item_id_fkey;
  END IF;
END $$;

-- Re-add the constraint with CASCADE delete if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'repair_order_items_parent_item_id_fkey'
      AND table_name = 'repair_order_items'
  ) THEN
    ALTER TABLE repair_order_items
      ADD CONSTRAINT repair_order_items_parent_item_id_fkey
      FOREIGN KEY (parent_item_id)
      REFERENCES repair_order_items(id)
      ON DELETE CASCADE;
  END IF;
END $$;
