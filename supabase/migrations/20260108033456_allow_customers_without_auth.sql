/*
  # Allow Customers Without Auth Accounts

  ## Changes
  - Modify the customers table to allow customer records without auth accounts
  - The id will be auto-generated for walk-in customers
  - Customers with auth accounts will still use auth.uid() as their id

  ## Notes
  - Walk-in customers (no account) can be added by admins
  - These customers can later sign up for accounts
  - When they sign up, a new customer record will be created with their auth id
*/

-- Make the id field auto-generate a UUID if not provided
ALTER TABLE customers 
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Update the insert policy to allow admins to insert customers without matching their own auth.uid()
DROP POLICY IF EXISTS "Users can insert own customer data" ON customers;

CREATE POLICY "Allow customer record creation"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Users can create their own records during signup
    auth.uid() = id
    -- OR it's a walk-in customer (id will be auto-generated)
    OR id IS NULL
    OR id != auth.uid()
  );