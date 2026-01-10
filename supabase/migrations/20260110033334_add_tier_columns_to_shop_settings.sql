/*
  # Add Tier Configuration Columns to Shop Settings

  1. Changes
    - Add individual tier configuration columns (bronze, silver, gold, platinum)
    - Each tier has minimum points and multiplier settings
    - Remove old tier_thresholds JSONB column if it exists
    - Add updated_by column for tracking who made changes

  2. Security
    - No RLS changes needed (existing policies apply)
*/

-- Add tier configuration columns
DO $$
BEGIN
  -- Bronze tier
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

  -- Add updated_by column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shop_settings' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE shop_settings ADD COLUMN updated_by uuid REFERENCES customers(id);
  END IF;
END $$;

-- Drop the old tier_thresholds column if it exists (we're using individual columns now)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shop_settings' AND column_name = 'tier_thresholds'
  ) THEN
    ALTER TABLE shop_settings DROP COLUMN tier_thresholds;
  END IF;
END $$;
