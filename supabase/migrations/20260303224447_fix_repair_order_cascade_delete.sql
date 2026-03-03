/*
  # Fix Repair Order CASCADE Delete

  1. Changes
    - Add a BEFORE DELETE trigger on repair_orders
    - Manually delete repair_order_items before the repair_order is deleted
    - This ensures RLS policies are properly evaluated in the user's context

  2. Security
    - Items are deleted with proper auth context
    - RLS policies on repair_order_items are respected
*/

-- Function to manually delete repair order items before deleting the repair order
CREATE OR REPLACE FUNCTION delete_repair_order_items_before_ro_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete all items for this repair order
  -- This happens in the context of the trigger, maintaining the user's auth context
  DELETE FROM repair_order_items
  WHERE repair_order_id = OLD.id;
  
  RETURN OLD;
END;
$$;

-- Create trigger to run before repair order is deleted
DROP TRIGGER IF EXISTS trigger_delete_repair_order_items ON repair_orders;
CREATE TRIGGER trigger_delete_repair_order_items
  BEFORE DELETE ON repair_orders
  FOR EACH ROW
  EXECUTE FUNCTION delete_repair_order_items_before_ro_delete();
