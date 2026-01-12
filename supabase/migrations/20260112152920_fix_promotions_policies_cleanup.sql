/*
  # Fix promotions policies - remove duplicates

  1. Changes
    - Drop all existing policies on promotions table
    - Create clean, non-conflicting policies using is_admin_for_shop_secure
    - Ensures admins can properly manage promotions
  
  2. Security
    - Maintains RLS protection
    - Uses SECURITY DEFINER function to avoid recursion
    - Admins can only manage promotions in their shop
*/

-- Drop all existing policies on promotions table
DROP POLICY IF EXISTS "View promotions" ON promotions;
DROP POLICY IF EXISTS "Create promotions" ON promotions;
DROP POLICY IF EXISTS "Update promotions" ON promotions;
DROP POLICY IF EXISTS "Delete promotions" ON promotions;
DROP POLICY IF EXISTS "Shop admins can view promotions" ON promotions;
DROP POLICY IF EXISTS "Shop admins can insert promotions" ON promotions;
DROP POLICY IF EXISTS "Shop admins can update promotions" ON promotions;
DROP POLICY IF EXISTS "Shop admins can delete promotions" ON promotions;
DROP POLICY IF EXISTS "Shop admins can manage promotions" ON promotions;
DROP POLICY IF EXISTS "Admins can view all promotions" ON promotions;
DROP POLICY IF EXISTS "Admins can insert promotions" ON promotions;
DROP POLICY IF EXISTS "Admins can update promotions" ON promotions;
DROP POLICY IF EXISTS "Admins can delete promotions" ON promotions;
DROP POLICY IF EXISTS "Super admins can do anything with promotions" ON promotions;
DROP POLICY IF EXISTS "Shop admins can manage their shop promotions" ON promotions;
DROP POLICY IF EXISTS "Users can view active promotions in their shop" ON promotions;

-- Create clean policies using is_admin_for_shop_secure
CREATE POLICY "Admins can view promotions in their shop"
  ON promotions FOR SELECT
  TO authenticated
  USING (is_admin_for_shop_secure(shop_id));

CREATE POLICY "Admins can create promotions in their shop"
  ON promotions FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_for_shop_secure(shop_id));

CREATE POLICY "Admins can update promotions in their shop"
  ON promotions FOR UPDATE
  TO authenticated
  USING (is_admin_for_shop_secure(shop_id))
  WITH CHECK (is_admin_for_shop_secure(shop_id));

CREATE POLICY "Admins can delete promotions in their shop"
  ON promotions FOR DELETE
  TO authenticated
  USING (is_admin_for_shop_secure(shop_id));
