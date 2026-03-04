/*
  # Clean up duplicate customer policies on repair_order_items

  1. Changes
    - Remove duplicate customer update policies
    - Keep only one clean policy for each operation
*/

DROP POLICY IF EXISTS "Customers can update own repair order items" ON repair_order_items;
DROP POLICY IF EXISTS "Customers update their RO item status" ON repair_order_items;

CREATE POLICY "Customers can update own repair order items"
  ON repair_order_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM repair_orders ro
      JOIN customers c ON c.id = ro.customer_id
      WHERE ro.id = repair_order_items.repair_order_id
      AND c.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM repair_orders ro
      JOIN customers c ON c.id = ro.customer_id
      WHERE ro.id = repair_order_items.repair_order_id
      AND c.auth_user_id = auth.uid()
    )
  );
