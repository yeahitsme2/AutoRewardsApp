/*
  # Fix all remaining tables RLS to avoid recursion
  
  1. Changes
    - Updates all policies that check admins table to use is_admin_for_shop helper
    - Fixes customers, shop_settings, reward_items, promotions, appointments tables
    - This prevents recursion when checking admin permissions
  
  2. Security
    - Admins can manage resources in their shop
    - All checks are secure and bypass RLS properly
*/

-- Fix customers table
DROP POLICY IF EXISTS "Shop admins can manage their shop customers" ON customers;

CREATE POLICY "Shop admins can manage their shop customers"
  ON customers
  FOR ALL
  TO authenticated
  USING (is_admin_for_shop(shop_id))
  WITH CHECK (is_admin_for_shop(shop_id));

-- Fix shop_settings table
DROP POLICY IF EXISTS "Shop admins can manage their settings" ON shop_settings;

CREATE POLICY "Shop admins can manage their settings"
  ON shop_settings
  FOR ALL
  TO authenticated
  USING (is_admin_for_shop(shop_id))
  WITH CHECK (is_admin_for_shop(shop_id));

-- Fix reward_items table
DROP POLICY IF EXISTS "Shop admins can manage reward items" ON reward_items;

CREATE POLICY "Shop admins can manage reward items"
  ON reward_items
  FOR ALL
  TO authenticated
  USING (is_admin_for_shop(shop_id))
  WITH CHECK (is_admin_for_shop(shop_id));

-- Fix promotions table
DROP POLICY IF EXISTS "Shop admins can manage promotions" ON promotions;

CREATE POLICY "Shop admins can manage promotions"
  ON promotions
  FOR ALL
  TO authenticated
  USING (is_admin_for_shop(shop_id))
  WITH CHECK (is_admin_for_shop(shop_id));

-- Fix appointments table
DROP POLICY IF EXISTS "Shop admins can manage shop appointments" ON appointments;

CREATE POLICY "Shop admins can manage shop appointments"
  ON appointments
  FOR ALL
  TO authenticated
  USING (is_admin_for_shop(shop_id))
  WITH CHECK (is_admin_for_shop(shop_id));