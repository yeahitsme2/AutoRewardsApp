/*
  # Fix Delete Repair Order Function Permissions

  1. Changes
    - Recreate the delete function with proper error handling
    - Ensure the function can delete both items and orders
    - Add better security context management

  2. Security
    - Function checks user permissions before deleting
    - Only admins/super_admins in the same shop can delete
*/

-- Drop and recreate the function with better error handling
DROP FUNCTION IF EXISTS delete_repair_order_with_items(uuid);

CREATE OR REPLACE FUNCTION delete_repair_order_with_items(p_repair_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id uuid;
  v_user_shop_id uuid;
  v_is_super_admin boolean;
BEGIN
  -- Get the shop_id of the repair order
  SELECT shop_id INTO v_shop_id
  FROM repair_orders
  WHERE id = p_repair_order_id;

  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'Repair order not found';
  END IF;

  -- Check if user is super admin
  SELECT is_super_admin INTO v_is_super_admin
  FROM super_admins
  WHERE auth_user_id = auth.uid();

  IF v_is_super_admin IS NULL THEN
    v_is_super_admin := false;
  END IF;

  -- If not super admin, check if user is admin in the same shop
  IF NOT v_is_super_admin THEN
    SELECT shop_id INTO v_user_shop_id
    FROM admins
    WHERE auth_user_id = auth.uid();

    IF v_user_shop_id IS NULL OR v_user_shop_id != v_shop_id THEN
      RAISE EXCEPTION 'Permission denied';
    END IF;
  END IF;

  -- Delete items first (bypass RLS since we've already checked permissions)
  DELETE FROM repair_order_items
  WHERE repair_order_id = p_repair_order_id;
  
  -- Then delete the repair order
  DELETE FROM repair_orders
  WHERE id = p_repair_order_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION delete_repair_order_with_items(uuid) TO authenticated;
