/*
  # Fix Admin RLS Policies - Use auth_user_id Instead of id

  ## Problem
  Current RLS policies check `c.id = auth.uid()` but customers.id is NOT the auth user ID.
  The correct field to check is `c.auth_user_id = auth.uid()`.

  ## Changes
  - Update all admin RLS policies to use `auth_user_id` instead of `id`
  - This affects: customers, vehicles, services, appointments, reward_items, promotions, and related tables
  - Ensures admins can properly access their shop's data

  ## Security
  - Maintains shop isolation
  - Fixes admin access to their shop's data
*/

DO $do$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'customers'
      AND column_name = 'auth_user_id'
  ) THEN

-- Helper function to get current user's shop_id (fixes auth_user_id reference)
CREATE OR REPLACE FUNCTION get_user_shop_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT shop_id 
    FROM customers 
    WHERE auth_user_id = auth.uid()
    LIMIT 1
  );
END;
$$;

-- Fix customers table policies
DROP POLICY IF EXISTS "Admins can view shop customers" ON customers;
CREATE POLICY "Admins can view shop customers"
  ON customers FOR SELECT
  TO authenticated
  USING (
    shop_id = get_user_shop_id()
    AND EXISTS (
      SELECT 1 FROM customers c
      WHERE c.auth_user_id = auth.uid()
      AND c.is_admin = true
    )
  );

DROP POLICY IF EXISTS "Admins can update shop customers" ON customers;
CREATE POLICY "Admins can update shop customers"
  ON customers FOR UPDATE
  TO authenticated
  USING (
    shop_id = get_user_shop_id()
    AND EXISTS (
      SELECT 1 FROM customers c
      WHERE c.auth_user_id = auth.uid()
      AND c.is_admin = true
    )
  )
  WITH CHECK (
    shop_id = get_user_shop_id()
    AND EXISTS (
      SELECT 1 FROM customers c
      WHERE c.auth_user_id = auth.uid()
      AND c.is_admin = true
    )
  );

DROP POLICY IF EXISTS "Admins can insert shop customers" ON customers;
CREATE POLICY "Admins can insert shop customers"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (
    shop_id = get_user_shop_id()
    AND EXISTS (
      SELECT 1 FROM customers c
      WHERE c.auth_user_id = auth.uid()
      AND c.is_admin = true
    )
  );

-- Fix vehicles table policies
DROP POLICY IF EXISTS "Admins can view shop vehicles" ON vehicles;
CREATE POLICY "Admins can view shop vehicles"
  ON vehicles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.auth_user_id = auth.uid()
      AND c.is_admin = true
      AND c.shop_id = (SELECT shop_id FROM customers WHERE id = vehicles.customer_id)
    )
  );

DROP POLICY IF EXISTS "Admins can insert shop vehicles" ON vehicles;
CREATE POLICY "Admins can insert shop vehicles"
  ON vehicles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.auth_user_id = auth.uid()
      AND c.is_admin = true
      AND c.shop_id = (SELECT shop_id FROM customers WHERE id = vehicles.customer_id)
    )
  );

DROP POLICY IF EXISTS "Admins can update shop vehicles" ON vehicles;
CREATE POLICY "Admins can update shop vehicles"
  ON vehicles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.auth_user_id = auth.uid()
      AND c.is_admin = true
      AND c.shop_id = (SELECT shop_id FROM customers WHERE id = vehicles.customer_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.auth_user_id = auth.uid()
      AND c.is_admin = true
      AND c.shop_id = (SELECT shop_id FROM customers WHERE id = vehicles.customer_id)
    )
  );

DROP POLICY IF EXISTS "Admins can delete shop vehicles" ON vehicles;
CREATE POLICY "Admins can delete shop vehicles"
  ON vehicles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.auth_user_id = auth.uid()
      AND c.is_admin = true
      AND c.shop_id = (SELECT shop_id FROM customers WHERE id = vehicles.customer_id)
    )
  );

-- Fix services table policies
DROP POLICY IF EXISTS "Admins can view shop services" ON services;
CREATE POLICY "Admins can view shop services"
  ON services FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.auth_user_id = auth.uid()
      AND c.is_admin = true
      AND c.shop_id = (SELECT shop_id FROM customers WHERE id = services.customer_id)
    )
  );

DROP POLICY IF EXISTS "Admins can insert shop services" ON services;
CREATE POLICY "Admins can insert shop services"
  ON services FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.auth_user_id = auth.uid()
      AND c.is_admin = true
      AND c.shop_id = (SELECT shop_id FROM customers WHERE id = services.customer_id)
    )
  );

DROP POLICY IF EXISTS "Admins can update shop services" ON services;
CREATE POLICY "Admins can update shop services"
  ON services FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.auth_user_id = auth.uid()
      AND c.is_admin = true
      AND c.shop_id = (SELECT shop_id FROM customers WHERE id = services.customer_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.auth_user_id = auth.uid()
      AND c.is_admin = true
      AND c.shop_id = (SELECT shop_id FROM customers WHERE id = services.customer_id)
    )
  );

DROP POLICY IF EXISTS "Admins can delete shop services" ON services;
CREATE POLICY "Admins can delete shop services"
  ON services FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.auth_user_id = auth.uid()
      AND c.is_admin = true
      AND c.shop_id = (SELECT shop_id FROM customers WHERE id = services.customer_id)
    )
  );

-- Fix appointments table policies
DROP POLICY IF EXISTS "Admins can view shop appointments" ON appointments;
CREATE POLICY "Admins can view shop appointments"
  ON appointments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.auth_user_id = auth.uid()
      AND c.is_admin = true
      AND c.shop_id = (SELECT shop_id FROM customers WHERE id = appointments.customer_id)
    )
  );

DROP POLICY IF EXISTS "Admins can update shop appointments" ON appointments;
CREATE POLICY "Admins can update shop appointments"
  ON appointments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.auth_user_id = auth.uid()
      AND c.is_admin = true
      AND c.shop_id = (SELECT shop_id FROM customers WHERE id = appointments.customer_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.auth_user_id = auth.uid()
      AND c.is_admin = true
      AND c.shop_id = (SELECT shop_id FROM customers WHERE id = appointments.customer_id)
    )
  );

-- Fix reward_items table policies
DROP POLICY IF EXISTS "Admins can view shop reward items" ON reward_items;
CREATE POLICY "Admins can view shop reward items"
  ON reward_items FOR SELECT
  TO authenticated
  USING (
    shop_id = get_user_shop_id()
    AND EXISTS (
      SELECT 1 FROM customers c
      WHERE c.auth_user_id = auth.uid()
      AND c.is_admin = true
    )
  );

DROP POLICY IF EXISTS "Admins can manage shop reward items" ON reward_items;
CREATE POLICY "Admins can manage shop reward items"
  ON reward_items FOR ALL
  TO authenticated
  USING (
    shop_id = get_user_shop_id()
    AND EXISTS (
      SELECT 1 FROM customers c
      WHERE c.auth_user_id = auth.uid()
      AND c.is_admin = true
    )
  )
  WITH CHECK (
    shop_id = get_user_shop_id()
    AND EXISTS (
      SELECT 1 FROM customers c
      WHERE c.auth_user_id = auth.uid()
      AND c.is_admin = true
    )
  );

-- Fix promotions table policies
DROP POLICY IF EXISTS "Admins can view shop promotions" ON promotions;
CREATE POLICY "Admins can view shop promotions"
  ON promotions FOR SELECT
  TO authenticated
  USING (
    shop_id = get_user_shop_id()
    AND EXISTS (
      SELECT 1 FROM customers c
      WHERE c.auth_user_id = auth.uid()
      AND c.is_admin = true
    )
  );

DROP POLICY IF EXISTS "Admins can manage shop promotions" ON promotions;
CREATE POLICY "Admins can manage shop promotions"
  ON promotions FOR ALL
  TO authenticated
  USING (
    shop_id = get_user_shop_id()
    AND EXISTS (
      SELECT 1 FROM customers c
      WHERE c.auth_user_id = auth.uid()
      AND c.is_admin = true
    )
  )
  WITH CHECK (
    shop_id = get_user_shop_id()
    AND EXISTS (
      SELECT 1 FROM customers c
      WHERE c.auth_user_id = auth.uid()
      AND c.is_admin = true
    )
  );

-- Fix shop_settings table policies
DROP POLICY IF EXISTS "Admins can view their shop settings" ON shop_settings;
CREATE POLICY "Admins can view their shop settings"
  ON shop_settings FOR SELECT
  TO authenticated
  USING (
    shop_id = get_user_shop_id()
    AND EXISTS (
      SELECT 1 FROM customers c
      WHERE c.auth_user_id = auth.uid()
      AND c.is_admin = true
    )
  );

DROP POLICY IF EXISTS "Admins can update their shop settings" ON shop_settings;
CREATE POLICY "Admins can update their shop settings"
  ON shop_settings FOR UPDATE
  TO authenticated
  USING (
    shop_id = get_user_shop_id()
    AND EXISTS (
      SELECT 1 FROM customers c
      WHERE c.auth_user_id = auth.uid()
      AND c.is_admin = true
    )
  )
  WITH CHECK (
    shop_id = get_user_shop_id()
    AND EXISTS (
      SELECT 1 FROM customers c
      WHERE c.auth_user_id = auth.uid()
      AND c.is_admin = true
    )
  );

-- Fix reward_redemptions table policies
DROP POLICY IF EXISTS "Admins can view shop redemptions" ON reward_redemptions;
CREATE POLICY "Admins can view shop redemptions"
  ON reward_redemptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.auth_user_id = auth.uid()
      AND c.is_admin = true
      AND c.shop_id = (SELECT shop_id FROM customers WHERE id = reward_redemptions.customer_id)
    )
  );

-- Fix shops table policies for admins to update their shop name
DROP POLICY IF EXISTS "Admins can update their shop name" ON shops;
CREATE POLICY "Admins can update their shop name"
  ON shops FOR UPDATE
  TO authenticated
  USING (
    id = get_user_shop_id()
    AND EXISTS (
      SELECT 1 FROM customers c
      WHERE c.auth_user_id = auth.uid()
      AND c.is_admin = true
    )
  )
  WITH CHECK (
    id = get_user_shop_id()
    AND EXISTS (
      SELECT 1 FROM customers c
      WHERE c.auth_user_id = auth.uid()
      AND c.is_admin = true
    )
  );

  END IF;
END $do$;
