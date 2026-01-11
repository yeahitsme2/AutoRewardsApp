/*
  # Fix services RLS to avoid recursion via admins table
  
  1. Changes
    - Updates services policies to use the is_admin_for_shop helper function
    - This prevents recursion when checking admin permissions
  
  2. Security
    - Admins can manage services in their shop
    - Customers can view their own services
    - All checks are secure and bypass RLS properly
*/

-- Drop existing admin policy for services
DROP POLICY IF EXISTS "Shop admins can manage their shop services" ON services;

-- Recreate policy using the bypass helper function
CREATE POLICY "Shop admins can manage their shop services"
  ON services
  FOR ALL
  TO authenticated
  USING (is_admin_for_shop(shop_id))
  WITH CHECK (is_admin_for_shop(shop_id));