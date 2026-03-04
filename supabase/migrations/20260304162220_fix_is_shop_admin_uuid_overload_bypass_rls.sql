/*
  # Fix is_shop_admin(uuid) overload to bypass RLS

  1. Problem
    - The is_shop_admin(uuid) function queries customers table with RLS
    - This can cause recursion issues

  2. Solution
    - Add row_security = off to bypass RLS
*/

CREATE OR REPLACE FUNCTION public.is_shop_admin(check_shop_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM customers
    WHERE id = auth.uid()
    AND is_admin = true
    AND shop_id = check_shop_id
  );
END;
$function$;
