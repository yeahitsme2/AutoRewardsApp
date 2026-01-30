/*
  # Add status to repair order items (pending/approved/declined)
*/

ALTER TABLE repair_order_items
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'repair_order_items_status_check'
  ) THEN
    ALTER TABLE repair_order_items
      ADD CONSTRAINT repair_order_items_status_check
      CHECK (status IN ('pending','approved','declined'));
  END IF;
END $$;
