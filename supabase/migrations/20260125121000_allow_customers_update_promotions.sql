/*
  # Allow customers to mark their promotions as read/used
*/

DO $do$
BEGIN
  DROP POLICY IF EXISTS "Customers can update own promotions" ON customer_promotions;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'auth_user_id'
  ) THEN
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
  ELSE
    CREATE POLICY "Customers can update own promotions"
      ON customer_promotions FOR UPDATE
      TO authenticated
      USING (customer_id = auth.uid())
      WITH CHECK (customer_id = auth.uid());
  END IF;
END
$do$;
