/*
  # Fix repair_order_items delete policy

  1. Problem
    - Delete operations failing with 500 error and empty message
    - The is_admin_for_repair_order_item function may have issues with RLS context

  2. Solution
    - Replace the delete policy with a simpler approach that joins directly
    - Use a subquery that doesn't depend on the row being deleted
*/

DROP POLICY IF EXISTS "Admins can delete shop repair order items" ON repair_order_items;

CREATE POLICY "Admins can delete shop repair order items"
  ON repair_order_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM repair_orders ro
      JOIN admins a ON a.shop_id = ro.shop_id 
        AND a.auth_user_id = auth.uid() 
        AND a.is_active = true
      WHERE ro.id = repair_order_items.repair_order_id
    )
  );
