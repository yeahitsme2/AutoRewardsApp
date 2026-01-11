/*
  # Fix admin check with SECURITY DEFINER function
  
  1. Changes
    - Creates a SECURITY DEFINER function to check admin access
    - This function bypasses RLS on the admins table
    - Updates all policies to use this function instead of direct queries
  
  2. Security
    - Function is SECURITY DEFINER so it can read admins table without RLS
    - Function only returns true/false, doesn't expose admin data
    - Maintains same security model
*/

-- Create a SECURITY DEFINER function to check if current user is admin for a shop
CREATE OR REPLACE FUNCTION public.is_admin_for_shop_secure(check_shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admins
    WHERE admins.auth_user_id = auth.uid()
    AND admins.shop_id = check_shop_id
    AND admins.is_active = true
  );
$$;

-- Update services policies
DROP POLICY IF EXISTS "Shop admins can view services" ON services;
DROP POLICY IF EXISTS "Shop admins can insert services" ON services;
DROP POLICY IF EXISTS "Shop admins can update services" ON services;
DROP POLICY IF EXISTS "Shop admins can delete services" ON services;

CREATE POLICY "Shop admins can view services"
  ON services FOR SELECT
  TO authenticated
  USING (is_admin_for_shop_secure(shop_id));

CREATE POLICY "Shop admins can insert services"
  ON services FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_for_shop_secure(shop_id));

CREATE POLICY "Shop admins can update services"
  ON services FOR UPDATE
  TO authenticated
  USING (is_admin_for_shop_secure(shop_id))
  WITH CHECK (is_admin_for_shop_secure(shop_id));

CREATE POLICY "Shop admins can delete services"
  ON services FOR DELETE
  TO authenticated
  USING (is_admin_for_shop_secure(shop_id));

-- Update vehicles policies
DROP POLICY IF EXISTS "Shop admins can view vehicles" ON vehicles;
DROP POLICY IF EXISTS "Shop admins can insert vehicles" ON vehicles;
DROP POLICY IF EXISTS "Shop admins can update vehicles" ON vehicles;
DROP POLICY IF EXISTS "Shop admins can delete vehicles" ON vehicles;

CREATE POLICY "Shop admins can view vehicles"
  ON vehicles FOR SELECT
  TO authenticated
  USING (is_admin_for_shop_secure(shop_id));

CREATE POLICY "Shop admins can insert vehicles"
  ON vehicles FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_for_shop_secure(shop_id));

CREATE POLICY "Shop admins can update vehicles"
  ON vehicles FOR UPDATE
  TO authenticated
  USING (is_admin_for_shop_secure(shop_id))
  WITH CHECK (is_admin_for_shop_secure(shop_id));

CREATE POLICY "Shop admins can delete vehicles"
  ON vehicles FOR DELETE
  TO authenticated
  USING (is_admin_for_shop_secure(shop_id));

-- Update reward_items policies
DROP POLICY IF EXISTS "Shop admins can view reward items" ON reward_items;
DROP POLICY IF EXISTS "Shop admins can insert reward items" ON reward_items;
DROP POLICY IF EXISTS "Shop admins can update reward items" ON reward_items;
DROP POLICY IF EXISTS "Shop admins can delete reward items" ON reward_items;

CREATE POLICY "Shop admins can view reward items"
  ON reward_items FOR SELECT
  TO authenticated
  USING (is_admin_for_shop_secure(shop_id));

CREATE POLICY "Shop admins can insert reward items"
  ON reward_items FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_for_shop_secure(shop_id));

CREATE POLICY "Shop admins can update reward items"
  ON reward_items FOR UPDATE
  TO authenticated
  USING (is_admin_for_shop_secure(shop_id))
  WITH CHECK (is_admin_for_shop_secure(shop_id));

CREATE POLICY "Shop admins can delete reward items"
  ON reward_items FOR DELETE
  TO authenticated
  USING (is_admin_for_shop_secure(shop_id));

-- Update promotions policies
DROP POLICY IF EXISTS "Shop admins can view promotions" ON promotions;
DROP POLICY IF EXISTS "Shop admins can insert promotions" ON promotions;
DROP POLICY IF EXISTS "Shop admins can update promotions" ON promotions;
DROP POLICY IF EXISTS "Shop admins can delete promotions" ON promotions;

CREATE POLICY "Shop admins can view promotions"
  ON promotions FOR SELECT
  TO authenticated
  USING (is_admin_for_shop_secure(shop_id));

CREATE POLICY "Shop admins can insert promotions"
  ON promotions FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_for_shop_secure(shop_id));

CREATE POLICY "Shop admins can update promotions"
  ON promotions FOR UPDATE
  TO authenticated
  USING (is_admin_for_shop_secure(shop_id))
  WITH CHECK (is_admin_for_shop_secure(shop_id));

CREATE POLICY "Shop admins can delete promotions"
  ON promotions FOR DELETE
  TO authenticated
  USING (is_admin_for_shop_secure(shop_id));

-- Update customers policies
DROP POLICY IF EXISTS "Shop admins can view customers" ON customers;
DROP POLICY IF EXISTS "Shop admins can insert customers" ON customers;
DROP POLICY IF EXISTS "Shop admins can update customers" ON customers;
DROP POLICY IF EXISTS "Shop admins can delete customers" ON customers;

CREATE POLICY "Shop admins can view customers"
  ON customers FOR SELECT
  TO authenticated
  USING (is_admin_for_shop_secure(shop_id));

CREATE POLICY "Shop admins can insert customers"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_for_shop_secure(shop_id));

CREATE POLICY "Shop admins can update customers"
  ON customers FOR UPDATE
  TO authenticated
  USING (is_admin_for_shop_secure(shop_id))
  WITH CHECK (is_admin_for_shop_secure(shop_id));

CREATE POLICY "Shop admins can delete customers"
  ON customers FOR DELETE
  TO authenticated
  USING (is_admin_for_shop_secure(shop_id));

-- Update appointments policies
DROP POLICY IF EXISTS "Shop admins can view appointments" ON appointments;
DROP POLICY IF EXISTS "Shop admins can insert appointments" ON appointments;
DROP POLICY IF EXISTS "Shop admins can update appointments" ON appointments;
DROP POLICY IF EXISTS "Shop admins can delete appointments" ON appointments;

CREATE POLICY "Shop admins can view appointments"
  ON appointments FOR SELECT
  TO authenticated
  USING (is_admin_for_shop_secure(shop_id));

CREATE POLICY "Shop admins can insert appointments"
  ON appointments FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_for_shop_secure(shop_id));

CREATE POLICY "Shop admins can update appointments"
  ON appointments FOR UPDATE
  TO authenticated
  USING (is_admin_for_shop_secure(shop_id))
  WITH CHECK (is_admin_for_shop_secure(shop_id));

CREATE POLICY "Shop admins can delete appointments"
  ON appointments FOR DELETE
  TO authenticated
  USING (is_admin_for_shop_secure(shop_id));

-- Update shop_settings policies
DROP POLICY IF EXISTS "Shop admins can view their shop settings" ON shop_settings;
DROP POLICY IF EXISTS "Shop admins can update their shop settings" ON shop_settings;

CREATE POLICY "Shop admins can view their shop settings"
  ON shop_settings FOR SELECT
  TO authenticated
  USING (is_admin_for_shop_secure(shop_id));

CREATE POLICY "Shop admins can update their shop settings"
  ON shop_settings FOR UPDATE
  TO authenticated
  USING (is_admin_for_shop_secure(shop_id))
  WITH CHECK (is_admin_for_shop_secure(shop_id));
