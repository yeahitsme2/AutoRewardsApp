/*
  # Fix update_customer_tier function to use correct columns
  
  1. Changes
    - Updates the `update_customer_tier()` function to use the actual tier columns from shop_settings
    - Instead of looking for `tier_thresholds` JSON column, it now uses:
      - `silver_points_min`
      - `gold_points_min`
      - `platinum_points_min`
    - Also uses the tier multipliers from the settings table
  
  2. Security
    - Function remains SECURITY DEFINER with search_path set
*/

CREATE OR REPLACE FUNCTION update_customer_tier()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  silver_threshold integer;
  gold_threshold integer;
  platinum_threshold integer;
  silver_mult numeric;
  gold_mult numeric;
  platinum_mult numeric;
  bronze_mult numeric;
BEGIN
  SELECT 
    COALESCE(silver_points_min, 500),
    COALESCE(gold_points_min, 1000),
    COALESCE(platinum_points_min, 2500),
    COALESCE(bronze_multiplier, 1.0),
    COALESCE(silver_multiplier, 1.25),
    COALESCE(gold_multiplier, 1.5),
    COALESCE(platinum_multiplier, 2.0)
  INTO 
    silver_threshold,
    gold_threshold,
    platinum_threshold,
    bronze_mult,
    silver_mult,
    gold_mult,
    platinum_mult
  FROM shop_settings
  WHERE shop_id = NEW.shop_id;
  
  IF NOT FOUND THEN
    silver_threshold := 500;
    gold_threshold := 1000;
    platinum_threshold := 2500;
    bronze_mult := 1.0;
    silver_mult := 1.25;
    gold_mult := 1.5;
    platinum_mult := 2.0;
  END IF;
  
  IF NEW.reward_points >= platinum_threshold THEN
    NEW.tier := 'platinum';
    NEW.tier_multiplier := platinum_mult;
  ELSIF NEW.reward_points >= gold_threshold THEN
    NEW.tier := 'gold';
    NEW.tier_multiplier := gold_mult;
  ELSIF NEW.reward_points >= silver_threshold THEN
    NEW.tier := 'silver';
    NEW.tier_multiplier := silver_mult;
  ELSE
    NEW.tier := 'bronze';
    NEW.tier_multiplier := bronze_mult;
  END IF;
  
  RETURN NEW;
END;
$$;