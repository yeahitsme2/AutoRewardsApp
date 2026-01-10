/*
  # Add Helper Function and Fix All Recursive Policies

  1. New Function
    - is_customer_in_admin_shop(customer_id) - checks if customer belongs to admin's shop
    - SECURITY DEFINER to bypass RLS

  2. Fix Policies
    - Tables with shop_id: use get_user_shop_id()
    - Tables with customer_id: use new helper function

  3. Tables Fixed
    - appointments, customer_promotions, reward_redemptions, services, vehicles
    - promotions, reward_items (already have shop_id)
*/

-- Create helper function to check if customer belongs to admin's shop
CREATE OR REPLACE FUNCTION is_customer_in_admin_shop(p_customer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM customers
    WHERE id = p_customer_id
    AND shop_id = get_user_shop_id()
  );
$$;

-- =====================================================
-- APPOINTMENTS (has shop_id column, let me verify)
-- =====================================================
DROP POLICY IF EXISTS "Admins can view shop appointments" ON appointments;
DROP POLICY IF EXISTS "Admins can update shop appointments" ON appointments;

CREATE POLICY "Admins can view shop appointments"
  ON appointments FOR SELECT
  TO authenticated
  USING (is_customer_in_admin_shop(customer_id) AND is_admin());

CREATE POLICY "Admins can update shop appointments"
  ON appointments FOR UPDATE
  TO authenticated
  USING (is_customer_in_admin_shop(customer_id) AND is_admin())
  WITH CHECK (is_customer_in_admin_shop(customer_id) AND is_admin());

-- =====================================================
-- CUSTOMER_PROMOTIONS (uses customer_id)
-- =====================================================
DROP POLICY IF EXISTS "Admins can insert shop customer promotions" ON customer_promotions;
DROP POLICY IF EXISTS "Admins can update shop customer promotions" ON customer_promotions;
DROP POLICY IF EXISTS "Admins can view shop customer promotions" ON customer_promotions;

CREATE POLICY "Admins can view shop customer promotions"
  ON customer_promotions FOR SELECT
  TO authenticated
  USING (is_customer_in_admin_shop(customer_id) AND is_admin());

CREATE POLICY "Admins can insert shop customer promotions"
  ON customer_promotions FOR INSERT
  TO authenticated
  WITH CHECK (is_customer_in_admin_shop(customer_id) AND is_admin());

CREATE POLICY "Admins can update shop customer promotions"
  ON customer_promotions FOR UPDATE
  TO authenticated
  USING (is_customer_in_admin_shop(customer_id) AND is_admin())
  WITH CHECK (is_customer_in_admin_shop(customer_id) AND is_admin());

-- =====================================================
-- PROMOTIONS (has shop_id)
-- =====================================================
DROP POLICY IF EXISTS "Admins can view shop promotions" ON promotions;
DROP POLICY IF EXISTS "Admins can insert shop promotions" ON promotions;
DROP POLICY IF EXISTS "Admins can update shop promotions" ON promotions;
DROP POLICY IF EXISTS "Admins can delete shop promotions" ON promotions;

CREATE POLICY "Admins can view shop promotions"
  ON promotions FOR SELECT
  TO authenticated
  USING (shop_id = get_user_shop_id() AND is_admin());

CREATE POLICY "Admins can insert shop promotions"
  ON promotions FOR INSERT
  TO authenticated
  WITH CHECK (shop_id = get_user_shop_id() AND is_admin());

CREATE POLICY "Admins can update shop promotions"
  ON promotions FOR UPDATE
  TO authenticated
  USING (shop_id = get_user_shop_id() AND is_admin())
  WITH CHECK (shop_id = get_user_shop_id() AND is_admin());

CREATE POLICY "Admins can delete shop promotions"
  ON promotions FOR DELETE
  TO authenticated
  USING (shop_id = get_user_shop_id() AND is_admin());

-- =====================================================
-- REWARD_ITEMS (has shop_id)
-- =====================================================
DROP POLICY IF EXISTS "Admins can view shop reward items" ON reward_items;
DROP POLICY IF EXISTS "Admins can insert shop reward items" ON reward_items;
DROP POLICY IF EXISTS "Admins can update shop reward items" ON reward_items;
DROP POLICY IF EXISTS "Admins can delete shop reward items" ON reward_items;

CREATE POLICY "Admins can view shop reward items"
  ON reward_items FOR SELECT
  TO authenticated
  USING (shop_id = get_user_shop_id() AND is_admin());

CREATE POLICY "Admins can insert shop reward items"
  ON reward_items FOR INSERT
  TO authenticated
  WITH CHECK (shop_id = get_user_shop_id() AND is_admin());

CREATE POLICY "Admins can update shop reward items"
  ON reward_items FOR UPDATE
  TO authenticated
  USING (shop_id = get_user_shop_id() AND is_admin())
  WITH CHECK (shop_id = get_user_shop_id() AND is_admin());

CREATE POLICY "Admins can delete shop reward items"
  ON reward_items FOR DELETE
  TO authenticated
  USING (shop_id = get_user_shop_id() AND is_admin());

-- =====================================================
-- REWARD_REDEMPTIONS (uses customer_id)
-- =====================================================
DROP POLICY IF EXISTS "Admins can view shop redemptions" ON reward_redemptions;
DROP POLICY IF EXISTS "Admins can insert shop redemptions" ON reward_redemptions;
DROP POLICY IF EXISTS "Admins can update shop redemptions" ON reward_redemptions;

CREATE POLICY "Admins can view shop redemptions"
  ON reward_redemptions FOR SELECT
  TO authenticated
  USING (is_customer_in_admin_shop(customer_id) AND is_admin());

CREATE POLICY "Admins can insert shop redemptions"
  ON reward_redemptions FOR INSERT
  TO authenticated
  WITH CHECK (is_customer_in_admin_shop(customer_id) AND is_admin());

CREATE POLICY "Admins can update shop redemptions"
  ON reward_redemptions FOR UPDATE
  TO authenticated
  USING (is_customer_in_admin_shop(customer_id) AND is_admin())
  WITH CHECK (is_customer_in_admin_shop(customer_id) AND is_admin());

-- =====================================================
-- SERVICES (uses customer_id)
-- =====================================================
DROP POLICY IF EXISTS "Admins can view shop services" ON services;
DROP POLICY IF EXISTS "Admins can insert shop services" ON services;
DROP POLICY IF EXISTS "Admins can update shop services" ON services;
DROP POLICY IF EXISTS "Admins can delete shop services" ON services;

CREATE POLICY "Admins can view shop services"
  ON services FOR SELECT
  TO authenticated
  USING (is_customer_in_admin_shop(customer_id) AND is_admin());

CREATE POLICY "Admins can insert shop services"
  ON services FOR INSERT
  TO authenticated
  WITH CHECK (is_customer_in_admin_shop(customer_id) AND is_admin());

CREATE POLICY "Admins can update shop services"
  ON services FOR UPDATE
  TO authenticated
  USING (is_customer_in_admin_shop(customer_id) AND is_admin())
  WITH CHECK (is_customer_in_admin_shop(customer_id) AND is_admin());

CREATE POLICY "Admins can delete shop services"
  ON services FOR DELETE
  TO authenticated
  USING (is_customer_in_admin_shop(customer_id) AND is_admin());

-- =====================================================
-- VEHICLES (uses customer_id)
-- =====================================================
DROP POLICY IF EXISTS "Admins can view shop vehicles" ON vehicles;
DROP POLICY IF EXISTS "Admins can insert shop vehicles" ON vehicles;
DROP POLICY IF EXISTS "Admins can update shop vehicles" ON vehicles;
DROP POLICY IF EXISTS "Admins can delete shop vehicles" ON vehicles;

CREATE POLICY "Admins can view shop vehicles"
  ON vehicles FOR SELECT
  TO authenticated
  USING (is_customer_in_admin_shop(customer_id) AND is_admin());

CREATE POLICY "Admins can insert shop vehicles"
  ON vehicles FOR INSERT
  TO authenticated
  WITH CHECK (is_customer_in_admin_shop(customer_id) AND is_admin());

CREATE POLICY "Admins can update shop vehicles"
  ON vehicles FOR UPDATE
  TO authenticated
  USING (is_customer_in_admin_shop(customer_id) AND is_admin())
  WITH CHECK (is_customer_in_admin_shop(customer_id) AND is_admin());

CREATE POLICY "Admins can delete shop vehicles"
  ON vehicles FOR DELETE
  TO authenticated
  USING (is_customer_in_admin_shop(customer_id) AND is_admin());
