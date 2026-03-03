/*
  # Remove manual part pricing and add automatic markup calculation

  1. Changes to parts table
     - Remove unit_price column (sale price will be calculated automatically)
     - Keep unit_cost (purchase price)

  2. New Functions
     - calculate_part_markup: Calculates the sale price based on markup rules
     - Given a shop_id and unit_cost, returns the marked-up price

  3. Notes
     - Markup rules are stored in repair_order_markup_rules table
     - Rules are applied based on cost ranges (min_cost to max_cost)
     - If no rule matches, returns the cost with no markup
*/

-- Drop the unit_price column from parts
ALTER TABLE parts DROP COLUMN IF EXISTS unit_price;

-- Function to calculate marked-up price based on shop markup rules
CREATE OR REPLACE FUNCTION calculate_part_markup(p_shop_id uuid, p_unit_cost numeric)
RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_markup_percent numeric;
  v_sale_price numeric;
BEGIN
  -- Find the applicable markup rule for this cost
  SELECT markup_percent INTO v_markup_percent
  FROM repair_order_markup_rules
  WHERE shop_id = p_shop_id
    AND is_active = true
    AND p_unit_cost >= min_cost
    AND (max_cost IS NULL OR p_unit_cost < max_cost)
  ORDER BY min_cost DESC
  LIMIT 1;

  -- If no rule found, return cost as-is
  IF v_markup_percent IS NULL THEN
    RETURN p_unit_cost;
  END IF;

  -- Calculate sale price with markup
  v_sale_price := p_unit_cost * (1 + (v_markup_percent / 100));
  
  -- Round to 2 decimal places
  RETURN ROUND(v_sale_price, 2);
END;
$$;
