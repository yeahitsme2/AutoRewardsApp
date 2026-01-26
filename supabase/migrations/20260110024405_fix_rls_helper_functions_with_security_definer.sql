/*
  # Fix RLS Helper Functions with SECURITY DEFINER

  1. Issue
    - Helper functions are causing circular dependencies with RLS policies
    - When RLS policies call these functions, the functions try to query tables protected by RLS,
      which triggers the policies again, causing infinite recursion and 500 errors

  2. Solution
    - Use CREATE OR REPLACE to update functions without dropping them
    - Add SECURITY DEFINER attribute to allow functions to bypass RLS
    - This prevents circular dependency issues

  3. Security
    - SECURITY DEFINER is safe here because these functions only read data
    - They don't accept user input that could be exploited
    - They only return boolean/UUID values for authorization checks
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
    -- Update get_user_shop_id with SECURITY DEFINER
    CREATE OR REPLACE FUNCTION get_user_shop_id()
    RETURNS uuid
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    STABLE
    AS $$
    BEGIN
      RETURN (
        SELECT shop_id
        FROM customers
        WHERE auth_user_id = auth.uid()
        LIMIT 1
      );
    END;
    $$;

    -- Update is_shop_admin with SECURITY DEFINER
    CREATE OR REPLACE FUNCTION is_shop_admin()
    RETURNS boolean
    LANGUAGE sql
    SECURITY DEFINER
    SET search_path = public
    STABLE
    AS $$
      SELECT EXISTS (
        SELECT 1 FROM customers
        WHERE auth_user_id = auth.uid() AND is_admin = true
      );
    $$;
  ELSE
    CREATE OR REPLACE FUNCTION get_user_shop_id()
    RETURNS uuid
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    STABLE
    AS $$
    BEGIN
      RETURN (
        SELECT shop_id
        FROM customers
        WHERE id = auth.uid()
        LIMIT 1
      );
    END;
    $$;

    CREATE OR REPLACE FUNCTION is_shop_admin()
    RETURNS boolean
    LANGUAGE sql
    SECURITY DEFINER
    SET search_path = public
    STABLE
    AS $$
      SELECT EXISTS (
        SELECT 1 FROM customers
        WHERE id = auth.uid() AND is_admin = true
      );
    $$;
  END IF;
END $do$;

-- Update is_super_admin with SECURITY DEFINER
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM super_admins WHERE id = auth.uid()
  );
$$;