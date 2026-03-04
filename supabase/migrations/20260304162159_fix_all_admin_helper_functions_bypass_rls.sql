/*
  # Fix all admin helper functions to bypass RLS

  1. Problem
    - Multiple admin helper functions query the admins table
    - The admins table has RLS enabled
    - This causes recursion when RLS policies use these functions
    - Results in 500 errors on delete/update operations

  2. Solution
    - Add row_security = off to all admin helper functions
    - Convert SQL functions to plpgsql to support SET options
    - This is safe because these are SECURITY DEFINER functions that validate internally
*/

CREATE OR REPLACE FUNCTION public.is_admin_for_shop_secure(check_shop_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admins
    WHERE admins.auth_user_id = auth.uid()
    AND admins.shop_id = check_shop_id
    AND admins.is_active = true
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_shop_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $function$
DECLARE
  v_shop_id uuid;
BEGIN
  SELECT shop_id INTO v_shop_id
  FROM admins
  WHERE auth_user_id = auth.uid()
  AND is_active = true
  LIMIT 1;
  
  RETURN v_shop_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_shop_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admins
    WHERE auth_user_id = auth.uid()
    AND is_active = true
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM super_admins
    WHERE id = auth.uid()
  );
END;
$function$;
