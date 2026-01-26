/*
  # Add has_account Column to Customers

  1. Changes
    - Add has_account boolean column to customers table
    - Default to false for walk-in customers
    - Set to true for customers with auth_user_id
    - Add trigger to automatically set has_account when auth_user_id changes

  2. Security
    - No RLS changes needed
*/

-- Add has_account column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'has_account'
  ) THEN
    ALTER TABLE customers ADD COLUMN has_account boolean DEFAULT false;
  END IF;
END $$;

DO $do$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'auth_user_id'
  ) THEN
    -- Update existing customers to set has_account based on auth_user_id
    UPDATE customers
    SET has_account = (auth_user_id IS NOT NULL)
    WHERE has_account IS NULL OR has_account != (auth_user_id IS NOT NULL);

    -- Create or replace trigger function to automatically maintain has_account
    CREATE OR REPLACE FUNCTION update_customer_has_account()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.has_account := (NEW.auth_user_id IS NOT NULL);
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- Drop trigger if it exists and recreate
    DROP TRIGGER IF EXISTS customer_has_account_trigger ON customers;

    CREATE TRIGGER customer_has_account_trigger
      BEFORE INSERT OR UPDATE OF auth_user_id ON customers
      FOR EACH ROW
      EXECUTE FUNCTION update_customer_has_account();
  END IF;
END
$do$;
