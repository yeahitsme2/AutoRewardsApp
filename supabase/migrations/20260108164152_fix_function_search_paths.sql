/*
  # Fix Function Search Paths

  1. Security Improvements
    - Set explicit search_path for all functions to prevent security vulnerabilities
    - Prevents functions from being affected by role-based search_path changes
    - Ensures functions always use the correct schema

  2. Functions Updated
    - update_customer_tier
    - update_lifetime_spending
    - process_reward_redemption
    - update_updated_at_column
    - update_customer_totals
    - is_admin
    - update_customer_tier_by_points
    - update_promotions_updated_at
    - update_customer_promotion_read_at
    - update_customer_promotion_used_at
    - make_first_user_admin
    - update_appointments_updated_at

  3. Security
    - All functions now have immutable search_path
    - Prevents search_path injection attacks
*/

-- Update is_admin function
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  admin_status boolean;
BEGIN
  SELECT is_admin INTO admin_status
  FROM customers
  WHERE id = auth.uid();
  
  RETURN COALESCE(admin_status, false);
END;
$$;

-- Update update_customer_tier function
CREATE OR REPLACE FUNCTION update_customer_tier()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.lifetime_spending >= 5000 THEN
    NEW.tier := 'platinum';
  ELSIF NEW.lifetime_spending >= 2000 THEN
    NEW.tier := 'gold';
  ELSIF NEW.lifetime_spending >= 500 THEN
    NEW.tier := 'silver';
  ELSE
    NEW.tier := 'bronze';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update update_lifetime_spending function
CREATE OR REPLACE FUNCTION update_lifetime_spending()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE customers
  SET lifetime_spending = (
    SELECT COALESCE(SUM(total_price), 0)
    FROM services
    WHERE customer_id = NEW.customer_id
  )
  WHERE id = NEW.customer_id;
  
  RETURN NEW;
END;
$$;

-- Update process_reward_redemption function
CREATE OR REPLACE FUNCTION process_reward_redemption()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  item_points integer;
  customer_current_points integer;
BEGIN
  SELECT points_required INTO item_points
  FROM reward_items
  WHERE id = NEW.reward_item_id;
  
  SELECT reward_points INTO customer_current_points
  FROM customers
  WHERE id = NEW.customer_id;
  
  IF customer_current_points < item_points THEN
    RAISE EXCEPTION 'Insufficient points for redemption';
  END IF;
  
  UPDATE customers
  SET reward_points = reward_points - item_points
  WHERE id = NEW.customer_id;
  
  RETURN NEW;
END;
$$;

-- Update update_updated_at_column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Update update_customer_totals function
CREATE OR REPLACE FUNCTION update_customer_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE customers
  SET 
    total_visits = (SELECT COUNT(*) FROM services WHERE customer_id = NEW.customer_id),
    lifetime_spending = (SELECT COALESCE(SUM(total_price), 0) FROM services WHERE customer_id = NEW.customer_id)
  WHERE id = NEW.customer_id;
  
  RETURN NEW;
END;
$$;

-- Update update_customer_tier_by_points function
CREATE OR REPLACE FUNCTION update_customer_tier_by_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  gold_threshold integer;
  platinum_threshold integer;
BEGIN
  SELECT 
    COALESCE((tier_thresholds->>'gold')::integer, 1000),
    COALESCE((tier_thresholds->>'platinum')::integer, 2500)
  INTO gold_threshold, platinum_threshold
  FROM shop_settings
  LIMIT 1;
  
  IF NEW.reward_points >= platinum_threshold THEN
    NEW.tier := 'platinum';
  ELSIF NEW.reward_points >= gold_threshold THEN
    NEW.tier := 'gold';
  ELSIF NEW.reward_points >= 500 THEN
    NEW.tier := 'silver';
  ELSE
    NEW.tier := 'bronze';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update update_promotions_updated_at function
CREATE OR REPLACE FUNCTION update_promotions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Update update_customer_promotion_read_at function
CREATE OR REPLACE FUNCTION update_customer_promotion_read_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.is_read = true AND (OLD.is_read = false OR OLD.is_read IS NULL) AND NEW.read_at IS NULL THEN
    NEW.read_at = now();
  END IF;
  RETURN NEW;
END;
$$;

-- Update update_customer_promotion_used_at function
CREATE OR REPLACE FUNCTION update_customer_promotion_used_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.is_used = true AND (OLD.is_used = false OR OLD.is_used IS NULL) AND NEW.used_at IS NULL THEN
    NEW.used_at = now();
  END IF;
  RETURN NEW;
END;
$$;

-- Update make_first_user_admin function
CREATE OR REPLACE FUNCTION make_first_user_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  customer_count integer;
BEGIN
  SELECT COUNT(*) INTO customer_count FROM customers WHERE has_account = true;
  
  IF customer_count = 0 THEN
    NEW.is_admin := true;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update update_appointments_updated_at function
CREATE OR REPLACE FUNCTION update_appointments_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
