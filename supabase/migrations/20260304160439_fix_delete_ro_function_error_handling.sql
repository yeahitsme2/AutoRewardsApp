/*
  # Fix Delete Repair Order Function Error Handling

  1. Changes
    - Change return type from void to jsonb for better error reporting
    - Add exception handling with detailed error messages
    - Return success/error status with details

  2. Security
    - Function checks user permissions before deleting
    - Only admins/super_admins in the same shop can delete
*/

DROP FUNCTION IF EXISTS delete_repair_order_with_items(uuid);

CREATE OR REPLACE FUNCTION delete_repair_order_with_items(p_repair_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id uuid;
  v_user_shop_id uuid;
  v_is_super_admin boolean;
BEGIN
  SELECT shop_id INTO v_shop_id
  FROM repair_orders
  WHERE id = p_repair_order_id;

  IF v_shop_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Repair order not found');
  END IF;

  SELECT true INTO v_is_super_admin
  FROM super_admins
  WHERE id = auth.uid();

  IF v_is_super_admin IS NULL THEN
    v_is_super_admin := false;
  END IF;

  IF NOT v_is_super_admin THEN
    SELECT shop_id INTO v_user_shop_id
    FROM admins
    WHERE auth_user_id = auth.uid() AND is_active = true;

    IF v_user_shop_id IS NULL OR v_user_shop_id != v_shop_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Permission denied');
    END IF;
  END IF;

  DELETE FROM repair_order_items
  WHERE repair_order_id = p_repair_order_id;
  
  DELETE FROM repair_orders
  WHERE id = p_repair_order_id;

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION delete_repair_order_with_items(uuid) TO authenticated;
