/*
  # Fix customer lifetime spending column reference

  1. Changes
    - Updates `update_lifetime_spending` function to use `total_lifetime_spending` instead of `lifetime_spending`
    - Updates `update_customer_totals` function to use `total_lifetime_spending` instead of `lifetime_spending`

  2. Reason
    - The customers table uses `total_lifetime_spending` column, not `lifetime_spending`
*/

CREATE OR REPLACE FUNCTION update_lifetime_spending()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE customers
  SET total_lifetime_spending = (
    SELECT COALESCE(SUM(amount), 0)
    FROM services
    WHERE customer_id = NEW.customer_id
  )
  WHERE id = NEW.customer_id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_customer_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE customers
  SET 
    total_lifetime_spending = (SELECT COALESCE(SUM(amount), 0) FROM services WHERE customer_id = NEW.customer_id)
  WHERE id = NEW.customer_id;

  RETURN NEW;
END;
$$;
