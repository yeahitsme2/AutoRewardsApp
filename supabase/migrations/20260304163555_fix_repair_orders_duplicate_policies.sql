/*
  # Fix repair_orders duplicate and conflicting policies

  1. Problem
    - Multiple duplicate policies for the same operations
    - "Admins can manage repair orders in their shop" with FOR ALL can cause recursion
    - Inconsistent use of helper functions vs direct queries
    
  2. Solution
    - Remove the FOR ALL policy
    - Remove duplicate policies
    - Use secure helper functions consistently
*/

DROP POLICY IF EXISTS "Admins can manage repair orders in their shop" ON repair_orders;

DROP POLICY IF EXISTS "Admins can create shop repair orders" ON repair_orders;
DROP POLICY IF EXISTS "Admins can create repair orders in their shop" ON repair_orders;
CREATE POLICY "Admins can create shop repair orders"
  ON repair_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_for_shop(shop_id));

DROP POLICY IF EXISTS "Admins can delete repair orders in their shop" ON repair_orders;
DROP POLICY IF EXISTS "Admins can delete shop repair orders" ON repair_orders;
CREATE POLICY "Admins can delete shop repair orders"
  ON repair_orders
  FOR DELETE
  TO authenticated
  USING (is_admin_for_shop(shop_id));

DROP POLICY IF EXISTS "Admins can view shop repair orders" ON repair_orders;
CREATE POLICY "Admins can view shop repair orders"
  ON repair_orders
  FOR SELECT
  TO authenticated
  USING (is_admin_for_shop(shop_id));

DROP POLICY IF EXISTS "Admins can update shop repair orders" ON repair_orders;
CREATE POLICY "Admins can update shop repair orders"
  ON repair_orders
  FOR UPDATE
  TO authenticated
  USING (is_admin_for_shop(shop_id))
  WITH CHECK (is_admin_for_shop(shop_id));
