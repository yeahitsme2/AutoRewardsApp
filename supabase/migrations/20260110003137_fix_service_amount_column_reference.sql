/*
  # Fix service amount column references

  1. Changes
    - Updates `update_lifetime_spending` function to use `amount` instead of `total_price`
    - Updates `update_customer_totals` function to use `amount` instead of `total_price`

  2. Reason
    - The services table uses `amount` column, not `total_price`
    - These functions were referencing the wrong column name causing insert errors
*/

CREATE OR REPLACE FUNCTION update_lifetime_spending()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE customers
  SET lifetime_spending = (
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
    total_visits = (SELECT COUNT(*) FROM services WHERE customer_id = NEW.customer_id),
    lifetime_spending = (SELECT COALESCE(SUM(amount), 0) FROM services WHERE customer_id = NEW.customer_id)
  WHERE id = NEW.customer_id;

  RETURN NEW;
END;
$$;
