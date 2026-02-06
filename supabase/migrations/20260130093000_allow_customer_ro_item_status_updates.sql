/*
  # Allow customers to update repair order item status
*/

ALTER TABLE repair_order_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'repair_order_items'
      AND policyname = 'Customers update their RO item status'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Customers update their RO item status"
      ON repair_order_items
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM repair_orders ro
          JOIN customers c ON c.id = ro.customer_id
          WHERE ro.id = repair_order_items.repair_order_id
            AND c.auth_user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM repair_orders ro
          JOIN customers c ON c.id = ro.customer_id
          WHERE ro.id = repair_order_items.repair_order_id
            AND c.auth_user_id = auth.uid()
        )
        AND status IN ('approved', 'declined')
      )
    $policy$;
  END IF;
END $$;
