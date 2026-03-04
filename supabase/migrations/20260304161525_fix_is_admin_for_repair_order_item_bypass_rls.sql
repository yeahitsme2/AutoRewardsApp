/*
  # Fix is_admin_for_repair_order_item to bypass RLS

  1. Problem
    - The function queries repair_order_items table which has RLS
    - This causes recursion when RLS policy calls this function
    - Results in 500 errors on delete operations

  2. Solution
    - Add row_security = off to bypass RLS within the function
*/

CREATE OR REPLACE FUNCTION public.is_admin_for_repair_order_item(p_item_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $function$
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
$function$;
