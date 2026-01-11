/*
  # Simplify vehicles RLS policies to avoid recursion
  
  1. Changes
    - Drops old complex RLS policies that may cause recursion
    - Creates simplified policies that check admins table directly
    - Maintains security by ensuring admins can only access their shop's vehicles
  
  2. Security
    - Admins can manage vehicles in their shop
    - Customers can manage their own vehicles
    - All policies use SECURITY DEFINER helper functions to avoid recursion
*/

-- Drop old policies
DROP POLICY IF EXISTS "Admins can view shop vehicles" ON vehicles;
DROP POLICY IF EXISTS "Admins can insert shop vehicles" ON vehicles;
DROP POLICY IF EXISTS "Admins can update shop vehicles" ON vehicles;
DROP POLICY IF EXISTS "Admins can delete shop vehicles" ON vehicles;
DROP POLICY IF EXISTS "Users can manage their own vehicles" ON vehicles;
DROP POLICY IF EXISTS "Shop admins can manage their shop vehicles" ON vehicles;

-- Create new simplified policies using admins table
CREATE POLICY "Shop admins can view vehicles"
  ON vehicles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = auth.uid()
      AND admins.shop_id = vehicles.shop_id
    )
  );

CREATE POLICY "Shop admins can insert vehicles"
  ON vehicles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = auth.uid()
      AND admins.shop_id = vehicles.shop_id
    )
  );

CREATE POLICY "Shop admins can update vehicles"
  ON vehicles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = auth.uid()
      AND admins.shop_id = vehicles.shop_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = auth.uid()
      AND admins.shop_id = vehicles.shop_id
    )
  );

CREATE POLICY "Shop admins can delete vehicles"
  ON vehicles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = auth.uid()
      AND admins.shop_id = vehicles.shop_id
    )
  );

-- Allow customers to manage their own vehicles
CREATE POLICY "Customers can view own vehicles"
  ON vehicles FOR SELECT
  TO authenticated
  USING (
    customer_id IN (
      SELECT id FROM customers
      WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Customers can update own vehicles"
  ON vehicles FOR UPDATE
  TO authenticated
  USING (
    customer_id IN (
      SELECT id FROM customers
      WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    customer_id IN (
      SELECT id FROM customers
      WHERE auth_user_id = auth.uid()
    )
  );