/*
  # Fix RLS recursion issues comprehensively

  1. Problem
    - Delete and update operations on repair_order_items fail with 500 errors
    - Policies that join to `admins` table trigger RLS on admins, causing recursion
    
  2. Solution
    - Create a helper function that checks admin status with RLS bypassed
    - Update policies to use this function instead of direct joins to admins
*/

CREATE OR REPLACE FUNCTION is_shop_admin_for_ro(p_repair_order_id uuid)
RETURNS boolean
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
  FROM repair_orders
  WHERE id = p_repair_order_id;
  
  IF v_shop_id IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN EXISTS (
    SELECT 1 FROM admins
    WHERE shop_id = v_shop_id
    AND auth_user_id = auth.uid()
    AND is_active = true
  );
END;
$$;

DROP POLICY IF EXISTS "Admins can delete shop repair order items" ON repair_order_items;
DROP POLICY IF EXISTS "Admins can update shop repair order items" ON repair_order_items;
DROP POLICY IF EXISTS "Admins can view shop repair order items" ON repair_order_items;
DROP POLICY IF EXISTS "Admins can create shop repair order items" ON repair_order_items;

CREATE POLICY "Admins can view shop repair order items"
  ON repair_order_items
  FOR SELECT
  TO authenticated
  USING (is_shop_admin_for_ro(repair_order_id));

CREATE POLICY "Admins can create shop repair order items"
  ON repair_order_items
  FOR INSERT
  TO authenticated
  WITH CHECK (is_shop_admin_for_ro(repair_order_id));

CREATE POLICY "Admins can update shop repair order items"
  ON repair_order_items
  FOR UPDATE
  TO authenticated
  USING (is_shop_admin_for_ro(repair_order_id))
  WITH CHECK (is_shop_admin_for_ro(repair_order_id));

CREATE POLICY "Admins can delete shop repair order items"
  ON repair_order_items
  FOR DELETE
  TO authenticated
  USING (is_shop_admin_for_ro(repair_order_id));

DROP POLICY IF EXISTS "Admins can update repair orders in their shop" ON repair_orders;
DROP POLICY IF EXISTS "Admins can update shop repair orders" ON repair_orders;

CREATE POLICY "Admins can update shop repair orders"
  ON repair_orders
  FOR UPDATE
  TO authenticated
  USING (is_admin_for_shop_secure(shop_id))
  WITH CHECK (is_admin_for_shop_secure(shop_id));
