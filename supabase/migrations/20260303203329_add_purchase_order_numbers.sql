/*
  # Add purchase order numbers

  1. Changes
    - Add po_number column to purchase_orders table
    - Add function to generate next PO number per shop
    - Add trigger to auto-assign PO number on insert

  2. Notes
    - PO numbers format: PO-YYYY-NNNN (e.g., PO-2026-0001)
    - Numbers are sequential per shop per year
*/

-- Add po_number column
ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS po_number text;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_purchase_orders_po_number ON purchase_orders(po_number);

-- Function to generate next PO number
CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_year text;
  next_number integer;
  new_po_number text;
BEGIN
  -- Get current year
  current_year := to_char(now(), 'YYYY');

  -- Get the next number for this shop and year
  SELECT COALESCE(MAX(
    CASE
      WHEN po_number ~ ('^PO-' || current_year || '-[0-9]{4}$')
      THEN CAST(substring(po_number from '[0-9]{4}$') AS integer)
      ELSE 0
    END
  ), 0) + 1
  INTO next_number
  FROM purchase_orders
  WHERE shop_id = NEW.shop_id;

  -- Generate PO number: PO-YYYY-NNNN
  new_po_number := 'PO-' || current_year || '-' || lpad(next_number::text, 4, '0');

  NEW.po_number := new_po_number;

  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_generate_po_number ON purchase_orders;
CREATE TRIGGER trigger_generate_po_number
  BEFORE INSERT ON purchase_orders
  FOR EACH ROW
  WHEN (NEW.po_number IS NULL)
  EXECUTE FUNCTION generate_po_number();

-- Backfill existing purchase orders with PO numbers
DO $$
DECLARE
  po_record RECORD;
  current_year text;
  next_number integer;
  new_po_number text;
BEGIN
  current_year := to_char(now(), 'YYYY');

  FOR po_record IN
    SELECT id, shop_id, created_at
    FROM purchase_orders
    WHERE po_number IS NULL
    ORDER BY shop_id, created_at
  LOOP
    -- Get year from created_at
    current_year := to_char(po_record.created_at, 'YYYY');

    -- Get next number for this shop and year
    SELECT COALESCE(MAX(
      CASE
        WHEN po_number ~ ('^PO-' || current_year || '-[0-9]{4}$')
        THEN CAST(substring(po_number from '[0-9]{4}$') AS integer)
        ELSE 0
      END
    ), 0) + 1
    INTO next_number
    FROM purchase_orders
    WHERE shop_id = po_record.shop_id;

    -- Generate PO number
    new_po_number := 'PO-' || current_year || '-' || lpad(next_number::text, 4, '0');

    -- Update the record
    UPDATE purchase_orders
    SET po_number = new_po_number
    WHERE id = po_record.id;
  END LOOP;
END $$;
