/*
  # Fix lifetime spending trigger

  1. Changes
    - Update the `update_lifetime_spending` function to use `amount` instead of `cost`
    - The services table uses `amount` field, not `cost`
  
  2. Security
    - No security changes, maintains existing RLS policies
*/

-- Recreate function with correct field name
CREATE OR REPLACE FUNCTION update_lifetime_spending()
RETURNS TRIGGER AS $$
BEGIN
  -- Add service amount to customer's lifetime spending
  UPDATE customers
  SET total_lifetime_spending = total_lifetime_spending + NEW.amount
  WHERE id = NEW.customer_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;