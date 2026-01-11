/*
  # Add tier_multiplier column to customers table
  
  1. Changes
    - Adds `tier_multiplier` column to customers table
    - This column stores the multiplier applied to points earned based on customer tier
    - Default value is 1.0 (bronze tier)
  
  2. Notes
    - Existing customers will get default value of 1.0
    - The update_customer_tier() function will update this value based on tier
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'tier_multiplier'
  ) THEN
    ALTER TABLE customers 
    ADD COLUMN tier_multiplier numeric DEFAULT 1.0 NOT NULL;
  END IF;
END $$;