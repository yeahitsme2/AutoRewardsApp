/*
  # Fix RLS Infinite Recursion
  
  1. Changes
    - Drop and recreate helper functions to properly bypass RLS
    - Use explicit table references with schema to avoid recursion
    - Ensure functions are stable and security definer
  
  2. Security
    - Functions are SECURITY DEFINER to bypass RLS
    - Only check auth.uid() which doesn't trigger RLS
*/

-- Drop existing functions
DROP FUNCTION IF EXISTS get_user_shop_id() CASCADE;
DROP FUNCTION IF EXISTS is_shop_admin() CASCADE;
DROP FUNCTION IF EXISTS is_super_admin() CASCADE;

-- Recreate is_super_admin (this one is safe, no recursion)
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM super_admins 
    WHERE id = auth.uid()
  );
$$;

-- Recreate get_user_shop_id to bypass RLS by using security definer properly
CREATE OR REPLACE FUNCTION get_user_shop_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id uuid;
BEGIN
  SELECT shop_id INTO v_shop_id
  FROM public.customers
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
  
  RETURN v_shop_id;
END;
$$;

-- Recreate is_shop_admin to bypass RLS
CREATE OR REPLACE FUNCTION is_shop_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT is_admin INTO v_is_admin
  FROM public.customers
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
  
  RETURN COALESCE(v_is_admin, false);
END;
$$;
