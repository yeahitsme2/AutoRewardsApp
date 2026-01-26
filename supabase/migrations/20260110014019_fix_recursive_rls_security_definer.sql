/*
  # Fix Recursive RLS with SECURITY DEFINER Functions
  
  1. Problem
    - Helper functions query tables that have RLS policies calling those functions
    - Creates infinite recursion causing "Database error querying schema"
  
  2. Solution
    - Drop ALL dependent policies first
    - Recreate functions with SECURITY DEFINER to bypass RLS checks
    - Recreate all policies
*/

-- Drop ALL policies that depend on the helper functions
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'super_admins'
  ) THEN
    DROP POLICY IF EXISTS "Super admins can view all super admins" ON super_admins;
  END IF;
END $do$;
DROP POLICY IF EXISTS "Super admins can do anything with shops" ON shops;
DROP POLICY IF EXISTS "Shop admins can view their shop" ON shops;
DROP POLICY IF EXISTS "Super admins can do anything with shop settings" ON shop_settings;
DROP POLICY IF EXISTS "Shop admins can manage their settings" ON shop_settings;
DROP POLICY IF EXISTS "Super admins can do anything with customers" ON customers;
DROP POLICY IF EXISTS "Shop admins can manage their shop customers" ON customers;
DROP POLICY IF EXISTS "Super admins can do anything with vehicles" ON vehicles;
DROP POLICY IF EXISTS "Shop admins can manage their shop vehicles" ON vehicles;
DROP POLICY IF EXISTS "Super admins can do anything with services" ON services;
DROP POLICY IF EXISTS "Shop admins can manage their shop services" ON services;
DROP POLICY IF EXISTS "Super admins can do anything with reward items" ON reward_items;
DROP POLICY IF EXISTS "Shop admins can manage their shop reward items" ON reward_items;
DROP POLICY IF EXISTS "Users can view active reward items in their shop" ON reward_items;
DROP POLICY IF EXISTS "Super admins can do anything with redemptions" ON reward_redemptions;
DROP POLICY IF EXISTS "Shop admins can manage their shop redemptions" ON reward_redemptions;
DROP POLICY IF EXISTS "Super admins can do anything with promotions" ON promotions;
DROP POLICY IF EXISTS "Shop admins can manage their shop promotions" ON promotions;
DROP POLICY IF EXISTS "Users can view active promotions in their shop" ON promotions;
DROP POLICY IF EXISTS "Super admins can do anything with customer promotions" ON customer_promotions;
DROP POLICY IF EXISTS "Shop admins can manage their shop customer promotions" ON customer_promotions;
DROP POLICY IF EXISTS "Super admins can do anything with appointments" ON appointments;
DROP POLICY IF EXISTS "Shop admins can manage their shop appointments" ON appointments;

-- Now drop and recreate functions with SECURITY DEFINER
DROP FUNCTION IF EXISTS is_super_admin();
DROP FUNCTION IF EXISTS is_shop_admin();
DROP FUNCTION IF EXISTS get_user_shop_id() CASCADE;

-- Ensure super_admins table exists (some schemas may not include it yet)
CREATE TABLE IF NOT EXISTS super_admins (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;

-- Recreate is_super_admin with SECURITY DEFINER
CREATE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
SELECT EXISTS (
  SELECT 1 FROM super_admins WHERE id = auth.uid()
);
$$;

-- Recreate is_shop_admin with SECURITY DEFINER (supports schemas without auth_user_id)
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'customers'
      AND column_name = 'auth_user_id'
  ) THEN
    CREATE FUNCTION is_shop_admin()
    RETURNS BOOLEAN
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $$
      SELECT EXISTS (
        SELECT 1 FROM customers
        WHERE auth_user_id = auth.uid() AND is_admin = true
      );
    $$;
  ELSE
    CREATE FUNCTION is_shop_admin()
    RETURNS BOOLEAN
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $$
      SELECT EXISTS (
        SELECT 1 FROM customers
        WHERE id = auth.uid() AND is_admin = true
      );
    $$;
  END IF;
END $do$;

-- Recreate get_user_shop_id with SECURITY DEFINER (supports schemas without auth_user_id)
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'customers'
      AND column_name = 'auth_user_id'
  ) THEN
    CREATE FUNCTION get_user_shop_id()
    RETURNS UUID
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $$
      SELECT shop_id FROM customers WHERE auth_user_id = auth.uid() LIMIT 1;
    $$;
  ELSE
    CREATE FUNCTION get_user_shop_id()
    RETURNS UUID
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $$
      SELECT shop_id FROM customers WHERE id = auth.uid() LIMIT 1;
    $$;
  END IF;
END $do$;

-- Recreate super_admins policy
CREATE POLICY "Super admins can view all super admins"
  ON super_admins FOR SELECT
  TO authenticated
  USING (is_super_admin());

-- Recreate shops policies  
CREATE POLICY "Super admins can do anything with shops"
  ON shops FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Shop admins can view their shop"
  ON shops FOR SELECT
  TO authenticated
  USING (id = get_user_shop_id());

-- Recreate shop_settings policies
CREATE POLICY "Super admins can do anything with shop settings"
  ON shop_settings FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Shop admins can manage their settings"
  ON shop_settings FOR ALL
  TO authenticated
  USING (shop_id = get_user_shop_id() AND is_shop_admin())
  WITH CHECK (shop_id = get_user_shop_id() AND is_shop_admin());

-- Recreate customers policies
CREATE POLICY "Super admins can do anything with customers"
  ON customers FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Shop admins can manage their shop customers"
  ON customers FOR ALL
  TO authenticated
  USING (shop_id = get_user_shop_id() AND is_shop_admin())
  WITH CHECK (shop_id = get_user_shop_id() AND is_shop_admin());

-- Recreate vehicles policies
CREATE POLICY "Super admins can do anything with vehicles"
  ON vehicles FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Shop admins can manage their shop vehicles"
  ON vehicles FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM customers c WHERE c.id = vehicles.customer_id AND c.shop_id = get_user_shop_id())
    AND is_shop_admin()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM customers c WHERE c.id = vehicles.customer_id AND c.shop_id = get_user_shop_id())
    AND is_shop_admin()
  );

-- Recreate services policies
CREATE POLICY "Super admins can do anything with services"
  ON services FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

DO $do$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'services'
      AND column_name = 'shop_id'
  ) THEN
    CREATE POLICY "Shop admins can manage their shop services"
      ON services FOR ALL
      TO authenticated
      USING (shop_id = get_user_shop_id() AND is_shop_admin())
      WITH CHECK (shop_id = get_user_shop_id() AND is_shop_admin());
  END IF;
END $do$;

-- Recreate reward_items policies
CREATE POLICY "Super admins can do anything with reward items"
  ON reward_items FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Shop admins can manage their shop reward items"
  ON reward_items FOR ALL
  TO authenticated
  USING (shop_id = get_user_shop_id() AND is_shop_admin())
  WITH CHECK (shop_id = get_user_shop_id() AND is_shop_admin());

CREATE POLICY "Users can view active reward items in their shop"
  ON reward_items FOR SELECT
  TO authenticated
  USING (shop_id = get_user_shop_id() AND is_active = true);

-- Recreate reward_redemptions policies
CREATE POLICY "Super admins can do anything with redemptions"
  ON reward_redemptions FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Shop admins can manage their shop redemptions"
  ON reward_redemptions FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM customers c WHERE c.id = reward_redemptions.customer_id AND c.shop_id = get_user_shop_id())
    AND is_shop_admin()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM customers c WHERE c.id = reward_redemptions.customer_id AND c.shop_id = get_user_shop_id())
    AND is_shop_admin()
  );

-- Recreate promotions policies
CREATE POLICY "Super admins can do anything with promotions"
  ON promotions FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Shop admins can manage their shop promotions"
  ON promotions FOR ALL
  TO authenticated
  USING (shop_id = get_user_shop_id() AND is_shop_admin())
  WITH CHECK (shop_id = get_user_shop_id() AND is_shop_admin());

CREATE POLICY "Users can view active promotions in their shop"
  ON promotions FOR SELECT
  TO authenticated
  USING (shop_id = get_user_shop_id() AND is_active = true);

-- Recreate customer_promotions policies
CREATE POLICY "Super admins can do anything with customer promotions"
  ON customer_promotions FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Shop admins can manage their shop customer promotions"
  ON customer_promotions FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM customers c WHERE c.id = customer_promotions.customer_id AND c.shop_id = get_user_shop_id())
    AND is_shop_admin()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM customers c WHERE c.id = customer_promotions.customer_id AND c.shop_id = get_user_shop_id())
    AND is_shop_admin()
  );

-- Recreate appointments policies
CREATE POLICY "Super admins can do anything with appointments"
  ON appointments FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Shop admins can manage their shop appointments"
  ON appointments FOR ALL
  TO authenticated
  USING (shop_id = get_user_shop_id() AND is_shop_admin())
  WITH CHECK (shop_id = get_user_shop_id() AND is_shop_admin());
