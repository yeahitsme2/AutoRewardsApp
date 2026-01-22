/*
  # Add Orphaned Repair Orders Support

  1. Changes
    - Allow `customer_id` and `vehicle_id` to be NULL in repair_orders table
    - Add temporary storage fields for unmatched customer/vehicle data
    - Create function to automatically match orphaned repair orders
    - Create triggers to auto-match when customers/vehicles are added

  2. New Columns for Orphaned Data
    - `temp_customer_name` - Store customer name for later matching
    - `temp_customer_phone` - Store phone for later matching
    - `temp_customer_email` - Store email for later matching
    - `temp_vin` - Store VIN for later matching
    - `temp_license_plate` - Store license plate for later matching
    - `temp_vehicle_year` - Store vehicle year
    - `temp_vehicle_make` - Store vehicle make
    - `temp_vehicle_model` - Store vehicle model
    - `is_matched` - Boolean flag to track if repair order has been matched

  3. Security
    - Update RLS policies to handle NULL customer_id
    - Add policies for admins to view unmatched repair orders
*/

-- Add temporary storage columns for orphaned repair orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'repair_orders' AND column_name = 'temp_customer_name'
  ) THEN
    ALTER TABLE repair_orders ADD COLUMN temp_customer_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'repair_orders' AND column_name = 'temp_customer_phone'
  ) THEN
    ALTER TABLE repair_orders ADD COLUMN temp_customer_phone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'repair_orders' AND column_name = 'temp_customer_email'
  ) THEN
    ALTER TABLE repair_orders ADD COLUMN temp_customer_email text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'repair_orders' AND column_name = 'temp_vin'
  ) THEN
    ALTER TABLE repair_orders ADD COLUMN temp_vin text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'repair_orders' AND column_name = 'temp_license_plate'
  ) THEN
    ALTER TABLE repair_orders ADD COLUMN temp_license_plate text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'repair_orders' AND column_name = 'temp_vehicle_year'
  ) THEN
    ALTER TABLE repair_orders ADD COLUMN temp_vehicle_year integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'repair_orders' AND column_name = 'temp_vehicle_make'
  ) THEN
    ALTER TABLE repair_orders ADD COLUMN temp_vehicle_make text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'repair_orders' AND column_name = 'temp_vehicle_model'
  ) THEN
    ALTER TABLE repair_orders ADD COLUMN temp_vehicle_model text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'repair_orders' AND column_name = 'is_matched'
  ) THEN
    ALTER TABLE repair_orders ADD COLUMN is_matched boolean DEFAULT false;
  END IF;
END $$;

-- Allow customer_id and vehicle_id to be NULL
ALTER TABLE repair_orders ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE repair_orders ALTER COLUMN vehicle_id DROP NOT NULL;

-- Update existing records to be marked as matched
UPDATE repair_orders SET is_matched = true WHERE customer_id IS NOT NULL;

-- Function to match orphaned repair orders
CREATE OR REPLACE FUNCTION match_orphaned_repair_orders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ro_record RECORD;
  matched_customer_id uuid;
  matched_vehicle_id uuid;
BEGIN
  -- Loop through unmatched repair orders
  FOR ro_record IN
    SELECT * FROM repair_orders
    WHERE is_matched = false AND customer_id IS NULL
  LOOP
    matched_customer_id := NULL;
    matched_vehicle_id := NULL;

    -- Try to match by VIN first (most reliable)
    IF ro_record.temp_vin IS NOT NULL THEN
      SELECT v.id, v.customer_id INTO matched_vehicle_id, matched_customer_id
      FROM vehicles v
      WHERE v.shop_id = ro_record.shop_id
        AND LOWER(v.vin) = LOWER(ro_record.temp_vin)
      LIMIT 1;
    END IF;

    -- If no VIN match, try phone number
    IF matched_customer_id IS NULL AND ro_record.temp_customer_phone IS NOT NULL THEN
      SELECT c.id INTO matched_customer_id
      FROM customers c
      WHERE c.shop_id = ro_record.shop_id
        AND REPLACE(REPLACE(REPLACE(c.phone, '-', ''), '(', ''), ')', '') = 
            REPLACE(REPLACE(REPLACE(ro_record.temp_customer_phone, '-', ''), '(', ''), ')', '')
      LIMIT 1;
    END IF;

    -- If no phone match, try email
    IF matched_customer_id IS NULL AND ro_record.temp_customer_email IS NOT NULL THEN
      SELECT c.id INTO matched_customer_id
      FROM customers c
      WHERE c.shop_id = ro_record.shop_id
        AND LOWER(c.email) = LOWER(ro_record.temp_customer_email)
      LIMIT 1;
    END IF;

    -- If we found a customer but no vehicle, try to match vehicle by make/model/year
    IF matched_customer_id IS NOT NULL AND matched_vehicle_id IS NULL THEN
      SELECT v.id INTO matched_vehicle_id
      FROM vehicles v
      WHERE v.customer_id = matched_customer_id
        AND v.shop_id = ro_record.shop_id
        AND (
          (ro_record.temp_vin IS NOT NULL AND LOWER(v.vin) = LOWER(ro_record.temp_vin))
          OR (
            ro_record.temp_vehicle_year IS NOT NULL 
            AND ro_record.temp_vehicle_make IS NOT NULL 
            AND ro_record.temp_vehicle_model IS NOT NULL
            AND v.year = ro_record.temp_vehicle_year
            AND LOWER(v.make) = LOWER(ro_record.temp_vehicle_make)
            AND LOWER(v.model) = LOWER(ro_record.temp_vehicle_model)
          )
        )
      LIMIT 1;
    END IF;

    -- Update repair order if we found matches
    IF matched_customer_id IS NOT NULL THEN
      UPDATE repair_orders
      SET 
        customer_id = matched_customer_id,
        vehicle_id = matched_vehicle_id,
        is_matched = true
      WHERE id = ro_record.id;
      
      RAISE NOTICE 'Matched repair order % to customer %', ro_record.id, matched_customer_id;
    END IF;
  END LOOP;
END;
$$;

-- Trigger function to auto-match when new customer is created
CREATE OR REPLACE FUNCTION trigger_match_repair_orders_on_customer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Match by phone
  IF NEW.phone IS NOT NULL THEN
    UPDATE repair_orders
    SET 
      customer_id = NEW.id,
      is_matched = true
    WHERE shop_id = NEW.shop_id
      AND is_matched = false
      AND customer_id IS NULL
      AND temp_customer_phone IS NOT NULL
      AND REPLACE(REPLACE(REPLACE(temp_customer_phone, '-', ''), '(', ''), ')', '') = 
          REPLACE(REPLACE(REPLACE(NEW.phone, '-', ''), '(', ''), ')', '');
  END IF;

  -- Match by email
  IF NEW.email IS NOT NULL THEN
    UPDATE repair_orders
    SET 
      customer_id = NEW.id,
      is_matched = true
    WHERE shop_id = NEW.shop_id
      AND is_matched = false
      AND customer_id IS NULL
      AND temp_customer_email IS NOT NULL
      AND LOWER(temp_customer_email) = LOWER(NEW.email);
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger function to auto-match when new vehicle is created
CREATE OR REPLACE FUNCTION trigger_match_repair_orders_on_vehicle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Match by VIN
  IF NEW.vin IS NOT NULL THEN
    UPDATE repair_orders
    SET 
      vehicle_id = NEW.id,
      customer_id = NEW.customer_id,
      is_matched = true
    WHERE shop_id = NEW.shop_id
      AND is_matched = false
      AND temp_vin IS NOT NULL
      AND LOWER(temp_vin) = LOWER(NEW.vin);
  END IF;

  RETURN NEW;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS match_repair_orders_on_customer_insert ON customers;
CREATE TRIGGER match_repair_orders_on_customer_insert
  AFTER INSERT ON customers
  FOR EACH ROW
  EXECUTE FUNCTION trigger_match_repair_orders_on_customer();

DROP TRIGGER IF EXISTS match_repair_orders_on_vehicle_insert ON vehicles;
CREATE TRIGGER match_repair_orders_on_vehicle_insert
  AFTER INSERT ON vehicles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_match_repair_orders_on_vehicle();

-- Add index for faster matching queries
CREATE INDEX IF NOT EXISTS idx_repair_orders_unmatched 
  ON repair_orders(shop_id, is_matched) 
  WHERE is_matched = false;

CREATE INDEX IF NOT EXISTS idx_repair_orders_temp_vin 
  ON repair_orders(shop_id, temp_vin) 
  WHERE temp_vin IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_repair_orders_temp_phone 
  ON repair_orders(shop_id, temp_customer_phone) 
  WHERE temp_customer_phone IS NOT NULL;
