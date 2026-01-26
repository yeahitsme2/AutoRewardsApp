/*
  # Allow customers to read promotions sent to them

  1. Changes
    - Add policy for customers to read promotions that have been sent to them
    - This allows customers to view promotion details in their dashboard

  2. Security
    - Customers can only read promotions that exist in their customer_promotions records
    - Maintains data isolation between customers
*/

-- Allow customers to read promotions that have been sent to them
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'promotions'
  ) THEN
    CREATE POLICY "Customers can read promotions sent to them"
      ON promotions
      FOR SELECT
      TO authenticated
      USING (
        id IN (
          SELECT promotion_id
          FROM customer_promotions
          WHERE customer_id = auth.uid()
        )
      );
  END IF;
END $$;
