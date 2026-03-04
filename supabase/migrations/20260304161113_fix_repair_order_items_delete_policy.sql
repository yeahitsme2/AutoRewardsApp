/*
  # Fix repair_order_items delete policy

  1. Problem
    - Delete operations on repair_order_items failing with 500 error
    - Current policy requires complex join that may be causing issues

  2. Solution
    - Use security definer function to check admin status
    - Simplify the RLS policy to avoid join issues
*/

CREATE OR REPLACE FUNCTION public.is_admin_for_repair_order_item(p_item_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id uuid;
BEGIN
  SELECT ro.shop_id INTO v_shop_id
  FROM repair_order_items roi
  JOIN repair_orders ro ON ro.id = roi.repair_order_id
  WHERE roi.id = p_item_id;
  
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

CREATE POLICY "Admins can delete shop repair order items"
  ON repair_order_items
  FOR DELETE
  TO authenticated
  USING (is_admin_for_repair_order_item(id));
