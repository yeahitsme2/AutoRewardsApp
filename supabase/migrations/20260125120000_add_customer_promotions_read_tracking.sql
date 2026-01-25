/*
  # Add read tracking to customer_promotions

  Adds:
  - is_read (boolean)
  - read_at (timestamptz)
  - trigger to auto-set read_at when is_read becomes true
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_promotions' AND column_name = 'is_read'
  ) THEN
    ALTER TABLE customer_promotions ADD COLUMN is_read boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_promotions' AND column_name = 'read_at'
  ) THEN
    ALTER TABLE customer_promotions ADD COLUMN read_at timestamptz;
  END IF;
END $$;

-- Function to automatically set read_at when is_read is set to true
CREATE OR REPLACE FUNCTION update_customer_promotion_read_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_read = true AND (OLD.is_read = false OR OLD.is_read IS NULL) AND NEW.read_at IS NULL THEN
    NEW.read_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update read_at on customer_promotions
DROP TRIGGER IF EXISTS trigger_update_customer_promotion_read_at ON customer_promotions;
CREATE TRIGGER trigger_update_customer_promotion_read_at
BEFORE UPDATE ON customer_promotions
FOR EACH ROW
EXECUTE FUNCTION update_customer_promotion_read_at();

-- Optional index for unread counts
CREATE INDEX IF NOT EXISTS idx_customer_promotions_is_read
  ON customer_promotions(is_read);
