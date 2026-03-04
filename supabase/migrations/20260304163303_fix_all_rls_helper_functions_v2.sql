/*
  # Fix all RLS helper functions to bypass RLS

  1. Problem
    - Multiple helper functions don't have row_security = off
    - This causes recursion when policies call functions that query RLS-protected tables
    
  2. Solution
    - Recreate all helper functions with SECURITY DEFINER and row_security = off
    - Clean up duplicate policies
*/

CREATE OR REPLACE FUNCTION shops_are_linked(shop_id_1 uuid, shop_id_2 uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
BEGIN
  IF shop_id_1 = shop_id_2 THEN
    RETURN true;
  END IF;
  
  RETURN EXISTS (
    SELECT 1 
    FROM shops s1
    JOIN shops s2 ON s1.shop_group_id = s2.shop_group_id
    WHERE s1.id = shop_id_1 
    AND s2.id = shop_id_2
    AND s1.shop_group_id IS NOT NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION get_admin_shop_id_from_table()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
DECLARE
  v_shop_id uuid;
BEGIN
  SELECT shop_id INTO v_shop_id
  FROM admins
  WHERE auth_user_id = auth.uid()
  AND is_active = true
  LIMIT 1;
  
  RETURN v_shop_id;
END;
$$;

CREATE OR REPLACE FUNCTION get_user_shop_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
DECLARE
  v_shop_id uuid;
BEGIN
  SELECT shop_id INTO v_shop_id
  FROM customers
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
  
  IF v_shop_id IS NOT NULL THEN
    RETURN v_shop_id;
  END IF;
  
  SELECT shop_id INTO v_shop_id
  FROM admins
  WHERE auth_user_id = auth.uid()
  AND is_active = true
  LIMIT 1;
  
  RETURN v_shop_id;
END;
$$;

CREATE OR REPLACE FUNCTION is_admin_for_shop(check_shop_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admins
    WHERE auth_user_id = auth.uid()
    AND shop_id = check_shop_id
    AND is_active = true
  );
END;
$$;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM super_admins
    WHERE id = auth.uid()
  );
END;
$$;

DROP POLICY IF EXISTS "Admins can view repair orders in their shop or group" ON repair_orders;

DROP POLICY IF EXISTS "Admins can view shop repair orders" ON repair_orders;
CREATE POLICY "Admins can view shop repair orders"
  ON repair_orders
  FOR SELECT
  TO authenticated
  USING (is_admin_for_shop(shop_id));

DROP POLICY IF EXISTS "Customers can view own repair orders" ON repair_orders;
DROP POLICY IF EXISTS "Customers can view their own repair orders" ON repair_orders;
CREATE POLICY "Customers can view own repair orders"
  ON repair_orders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.auth_user_id = auth.uid()
      AND customers.id = repair_orders.customer_id
    )
  );

DROP POLICY IF EXISTS "Customers can view own repair order items" ON repair_order_items;
DROP POLICY IF EXISTS "Customers can view their own repair order items" ON repair_order_items;
CREATE POLICY "Customers can view own repair order items"
  ON repair_order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM repair_orders ro
      JOIN customers c ON c.id = ro.customer_id
      WHERE ro.id = repair_order_items.repair_order_id
      AND c.auth_user_id = auth.uid()
    )
  );
