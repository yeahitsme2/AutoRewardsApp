/*
  # Update Tier Calculation to Use Shop Settings

  1. Changes
    - Replace hardcoded tier thresholds with values from shop_settings table
    - Tier calculations now use configurable values set by admins
    - Makes the tier system fully customizable from the admin panel
  
  2. How It Works
    - When a customer's reward_points change, the trigger reads from shop_settings
    - Compares points against the configured thresholds
    - Assigns tier and multiplier based on settings
  
  3. Security
    - No RLS changes needed
    - Trigger runs with elevated privileges
*/

-- Drop and recreate the tier calculation function to use shop_settings
CREATE OR REPLACE FUNCTION update_customer_tier_by_points()
RETURNS TRIGGER AS $$
DECLARE
  settings RECORD;
BEGIN
  -- Get tier settings from shop_settings table
  SELECT 
    bronze_points_min, bronze_multiplier,
    silver_points_min, silver_multiplier,
    gold_points_min, gold_multiplier,
    platinum_points_min, platinum_multiplier
  INTO settings
  FROM shop_settings
  LIMIT 1;

  -- If no settings found, use defaults
  IF settings IS NULL THEN
    settings.bronze_points_min := 0;
    settings.bronze_multiplier := 1.0;
    settings.silver_points_min := 500;
    settings.silver_multiplier := 1.25;
    settings.gold_points_min := 1500;
    settings.gold_multiplier := 1.5;
    settings.platinum_points_min := 3000;
    settings.platinum_multiplier := 2.0;
  END IF;

  -- Update tier based on reward points using settings
  IF NEW.reward_points >= settings.platinum_points_min THEN
    NEW.tier = 'platinum';
    NEW.tier_multiplier = settings.platinum_multiplier;
  ELSIF NEW.reward_points >= settings.gold_points_min THEN
    NEW.tier = 'gold';
    NEW.tier_multiplier = settings.gold_multiplier;
  ELSIF NEW.reward_points >= settings.silver_points_min THEN
    NEW.tier = 'silver';
    NEW.tier_multiplier = settings.silver_multiplier;
  ELSE
    NEW.tier = 'bronze';
    NEW.tier_multiplier = settings.bronze_multiplier;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
