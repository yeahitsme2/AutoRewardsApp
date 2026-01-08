/*
  # Add Membership Tiers and Service Reminders

  ## 1. Membership Tiers
  Adds tiered membership system to reward loyal customers:
    - Add `tier` column to customers table (bronze, silver, gold, platinum)
    - Add `total_lifetime_spending` column to track cumulative spending
    - Add `tier_multiplier` column for bonus point calculations
    
  Tier Requirements:
    - Bronze: $0+ (default, 1x points)
    - Silver: $500+ (1.25x points)
    - Gold: $1,500+ (1.5x points)
    - Platinum: $3,000+ (2x points)

  ## 2. Service Reminders
  Adds maintenance tracking for vehicles:
    - Add `last_service_date` to vehicles table
    - Add `last_service_mileage` to vehicles table
    - Add `current_mileage` to vehicles table
    - Add `next_service_due_date` for time-based reminders
    - Add `next_service_due_mileage` for mileage-based reminders

  ## 3. Security
    - Maintains existing RLS policies
    - All new columns accessible under existing policies
*/

-- Add tier and lifetime spending to customers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'tier'
  ) THEN
    ALTER TABLE customers ADD COLUMN tier text DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'total_lifetime_spending'
  ) THEN
    ALTER TABLE customers ADD COLUMN total_lifetime_spending decimal(10,2) DEFAULT 0.00;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'tier_multiplier'
  ) THEN
    ALTER TABLE customers ADD COLUMN tier_multiplier decimal(3,2) DEFAULT 1.00;
  END IF;
END $$;

-- Add service tracking to vehicles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'current_mileage'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN current_mileage integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'last_service_date'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN last_service_date timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'last_service_mileage'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN last_service_mileage integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'next_service_due_date'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN next_service_due_date timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'next_service_due_mileage'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN next_service_due_mileage integer;
  END IF;
END $$;

-- Create function to automatically update customer tier based on lifetime spending
CREATE OR REPLACE FUNCTION update_customer_tier()
RETURNS TRIGGER AS $$
BEGIN
  -- Update tier based on total lifetime spending
  IF NEW.total_lifetime_spending >= 3000 THEN
    NEW.tier = 'platinum';
    NEW.tier_multiplier = 2.00;
  ELSIF NEW.total_lifetime_spending >= 1500 THEN
    NEW.tier = 'gold';
    NEW.tier_multiplier = 1.50;
  ELSIF NEW.total_lifetime_spending >= 500 THEN
    NEW.tier = 'silver';
    NEW.tier_multiplier = 1.25;
  ELSE
    NEW.tier = 'bronze';
    NEW.tier_multiplier = 1.00;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update tier when lifetime spending changes
DROP TRIGGER IF EXISTS update_tier_on_spending ON customers;
CREATE TRIGGER update_tier_on_spending
  BEFORE UPDATE OF total_lifetime_spending ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_tier();

-- Create function to update lifetime spending when service is added
CREATE OR REPLACE FUNCTION update_lifetime_spending()
RETURNS TRIGGER AS $$
BEGIN
  -- Add service cost to customer's lifetime spending
  UPDATE customers
  SET total_lifetime_spending = total_lifetime_spending + NEW.cost
  WHERE id = NEW.customer_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update lifetime spending when service is added
DROP TRIGGER IF EXISTS add_to_lifetime_spending ON services;
CREATE TRIGGER add_to_lifetime_spending
  AFTER INSERT ON services
  FOR EACH ROW
  EXECUTE FUNCTION update_lifetime_spending();