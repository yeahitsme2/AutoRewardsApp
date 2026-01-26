/*
  # Allow authenticated users to create their own customer record

  1. Security Changes
    - Add INSERT policy for customers table allowing users to create their own record
    - Policy ensures auth_user_id matches the authenticated user

  2. Notes
    - This enables the signup flow where a new user creates their customer profile
*/

DO $do$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'customers'
      AND column_name = 'auth_user_id'
  ) THEN
    CREATE POLICY "Users can create their own customer record"
      ON customers
      FOR INSERT
      TO authenticated
      WITH CHECK (auth_user_id = auth.uid());
  ELSE
    CREATE POLICY "Users can create their own customer record"
      ON customers
      FOR INSERT
      TO authenticated
      WITH CHECK (id = auth.uid());
  END IF;
END $do$;
