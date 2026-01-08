/*
  # Change Tier System to Points-Based

  1. Changes
    - Update tier progression to be based on reward points instead of spending
    - Keep total_lifetime_spending for display purposes only
    - Remove tier calculation trigger from spending updates
    - Add new trigger to update tiers based on reward points
    
  2. New Tier Requirements (Points-Based)
    - Bronze: 0+ points (default, 1x points)
    - Silver: 500+ points (1.25x points)
    - Gold: 1500+ points (1.5x points)
    - Platinum: 3000+ points (2x points)
  
  3. Security
    - Maintains existing RLS policies
    - No security changes
*/

-- Drop the old spending-based tier trigger
DROP TRIGGER IF EXISTS update_tier_on_spending ON customers;

-- Create new function to update customer tier based on reward points
CREATE OR REPLACE FUNCTION update_customer_tier_by_points()
RETURNS TRIGGER AS $$
BEGIN
  -- Update tier based on reward points (not spending)
  IF NEW.reward_points >= 3000 THEN
    NEW.tier = 'platinum';
    NEW.tier_multiplier = 2.00;
  ELSIF NEW.reward_points >= 1500 THEN
    NEW.tier = 'gold';
    NEW.tier_multiplier = 1.50;
  ELSIF NEW.reward_points >= 500 THEN
    NEW.tier = 'silver';
    NEW.tier_multiplier = 1.25;
  ELSE
    NEW.tier = 'bronze';
    NEW.tier_multiplier = 1.00;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update tier when reward points change
CREATE TRIGGER update_tier_on_points
  BEFORE UPDATE OF reward_points ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_tier_by_points();

-- Update existing customer tiers based on their current points
UPDATE customers
SET tier = CASE
  WHEN reward_points >= 3000 THEN 'platinum'
  WHEN reward_points >= 1500 THEN 'gold'
  WHEN reward_points >= 500 THEN 'silver'
  ELSE 'bronze'
END,
tier_multiplier = CASE
  WHEN reward_points >= 3000 THEN 2.00
  WHEN reward_points >= 1500 THEN 1.50
  WHEN reward_points >= 500 THEN 1.25
  ELSE 1.00
END;