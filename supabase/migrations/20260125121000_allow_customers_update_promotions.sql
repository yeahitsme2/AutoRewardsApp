/*
  # Allow customers to mark their promotions as read/used
*/

DROP POLICY IF EXISTS "Customers can update own promotions" ON customer_promotions;
CREATE POLICY "Customers can update own promotions"
  ON customer_promotions FOR UPDATE
  TO authenticated
  USING (
    customer_id IN (
      SELECT customers.id FROM customers WHERE customers.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    customer_id IN (
      SELECT customers.id FROM customers WHERE customers.auth_user_id = auth.uid()
    )
  );
