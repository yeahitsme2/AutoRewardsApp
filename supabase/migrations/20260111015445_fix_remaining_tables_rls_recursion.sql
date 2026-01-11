/*
  # Fix remaining tables RLS to avoid recursion
  
  1. Changes
    - Updates all remaining policies that directly query admins table
    - Replaces EXISTS queries with is_admin_for_shop helper function
    - Fixes: customer_promotions, reward_redemptions, shops, promotions policies
  
  2. Security
    - Admins can manage resources in their shop
    - All checks are secure and bypass RLS properly
*/

-- Fix customer_promotions table
DROP POLICY IF EXISTS "Shop admins can manage their shop customer promotions" ON customer_promotions;

CREATE POLICY "Shop admins can manage their shop customer promotions"
  ON customer_promotions
  FOR ALL
  TO authenticated
  USING (
    is_admin_for_shop((SELECT shop_id FROM customers WHERE id = customer_promotions.customer_id))
  )
  WITH CHECK (
    is_admin_for_shop((SELECT shop_id FROM customers WHERE id = customer_promotions.customer_id))
  );

-- Fix reward_redemptions table
DROP POLICY IF EXISTS "Shop admins can manage their shop redemptions" ON reward_redemptions;

CREATE POLICY "Shop admins can manage their shop redemptions"
  ON reward_redemptions
  FOR ALL
  TO authenticated
  USING (
    is_admin_for_shop((SELECT shop_id FROM customers WHERE id = reward_redemptions.customer_id))
  )
  WITH CHECK (
    is_admin_for_shop((SELECT shop_id FROM customers WHERE id = reward_redemptions.customer_id))
  );

-- Fix shops table
DROP POLICY IF EXISTS "Shop admins can update their shop" ON shops;

CREATE POLICY "Shop admins can update their shop"
  ON shops
  FOR UPDATE
  TO authenticated
  USING (is_admin_for_shop(id))
  WITH CHECK (is_admin_for_shop(id));

-- Fix promotions table policies
DROP POLICY IF EXISTS "View promotions" ON promotions;
DROP POLICY IF EXISTS "Create promotions" ON promotions;
DROP POLICY IF EXISTS "Update promotions" ON promotions;
DROP POLICY IF EXISTS "Delete promotions" ON promotions;

CREATE POLICY "View promotions"
  ON promotions
  FOR SELECT
  TO authenticated
  USING (is_admin_for_shop(shop_id));

CREATE POLICY "Create promotions"
  ON promotions
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_for_shop(shop_id));

CREATE POLICY "Update promotions"
  ON promotions
  FOR UPDATE
  TO authenticated
  USING (is_admin_for_shop(shop_id))
  WITH CHECK (is_admin_for_shop(shop_id));

CREATE POLICY "Delete promotions"
  ON promotions
  FOR DELETE
  TO authenticated
  USING (is_admin_for_shop(shop_id));

-- Fix shop_settings UPDATE policy
DROP POLICY IF EXISTS "Shop admins can update their shop settings" ON shop_settings;

CREATE POLICY "Shop admins can update their shop settings"
  ON shop_settings
  FOR UPDATE
  TO authenticated
  USING (
    is_super_admin() OR is_admin_for_shop(shop_id)
  )
  WITH CHECK (
    is_super_admin() OR is_admin_for_shop(shop_id)
  );