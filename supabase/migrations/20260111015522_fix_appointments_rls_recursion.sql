/*
  # Fix appointments RLS to avoid recursion
  
  1. Changes
    - Drops the old appointments policy that queries admins table directly
    - Creates new policy using is_admin_for_shop helper function
    - This prevents recursion when checking admin permissions
  
  2. Security
    - Admins can manage appointments in their shop
    - Customers can manage their own appointments
*/

-- Drop the old recursive policy
DROP POLICY IF EXISTS "Shop admins can manage their shop appointments" ON appointments;

-- Create new policy using the bypass helper function
CREATE POLICY "Shop admins can manage their shop appointments"
  ON appointments
  FOR ALL
  TO authenticated
  USING (is_admin_for_shop(shop_id))
  WITH CHECK (is_admin_for_shop(shop_id));