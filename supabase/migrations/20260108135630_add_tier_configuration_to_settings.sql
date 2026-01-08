/*
  # Add Tier Configuration to Shop Settings

  1. Changes to shop_settings table
    - Add `bronze_points_min` (integer, default 0) - Minimum points for Bronze tier
    - Add `bronze_multiplier` (numeric, default 1.0) - Points multiplier for Bronze tier
    - Add `silver_points_min` (integer, default 500) - Minimum points for Silver tier
    - Add `silver_multiplier` (numeric, default 1.25) - Points multiplier for Silver tier
    - Add `gold_points_min` (integer, default 1500) - Minimum points for Gold tier
    - Add `gold_multiplier` (numeric, default 1.5) - Points multiplier for Gold tier
    - Add `platinum_points_min` (integer, default 3000) - Minimum points for Platinum tier
    - Add `platinum_multiplier` (numeric, default 2.0) - Points multiplier for Platinum tier
  
  2. Purpose
    - Allow admins to customize tier thresholds and multipliers from the admin settings
    - Make the tier system configurable instead of hardcoded
  
  3. Security
    - No RLS changes needed (existing policies apply)
*/

-- Add tier configuration columns to shop_settings
DO $$
BEGIN
  -- Bronze tier (default tier, starts at 0 points)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shop_settings' AND column_name = 'bronze_points_min'
  ) THEN
    ALTER TABLE shop_settings ADD COLUMN bronze_points_min integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shop_settings' AND column_name = 'bronze_multiplier'
  ) THEN
    ALTER TABLE shop_settings ADD COLUMN bronze_multiplier numeric NOT NULL DEFAULT 1.0;
  END IF;

  -- Silver tier
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shop_settings' AND column_name = 'silver_points_min'
  ) THEN
    ALTER TABLE shop_settings ADD COLUMN silver_points_min integer NOT NULL DEFAULT 500;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shop_settings' AND column_name = 'silver_multiplier'
  ) THEN
    ALTER TABLE shop_settings ADD COLUMN silver_multiplier numeric NOT NULL DEFAULT 1.25;
  END IF;

  -- Gold tier
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shop_settings' AND column_name = 'gold_points_min'
  ) THEN
    ALTER TABLE shop_settings ADD COLUMN gold_points_min integer NOT NULL DEFAULT 1500;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shop_settings' AND column_name = 'gold_multiplier'
  ) THEN
    ALTER TABLE shop_settings ADD COLUMN gold_multiplier numeric NOT NULL DEFAULT 1.5;
  END IF;

  -- Platinum tier
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shop_settings' AND column_name = 'platinum_points_min'
  ) THEN
    ALTER TABLE shop_settings ADD COLUMN platinum_points_min integer NOT NULL DEFAULT 3000;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shop_settings' AND column_name = 'platinum_multiplier'
  ) THEN
    ALTER TABLE shop_settings ADD COLUMN platinum_multiplier numeric NOT NULL DEFAULT 2.0;
  END IF;
END $$;
