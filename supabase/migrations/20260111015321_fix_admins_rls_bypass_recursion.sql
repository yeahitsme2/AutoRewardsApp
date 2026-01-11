/*
  # Fix admins RLS to completely avoid recursion
  
  1. Changes
    - Drops the recursive policy "Admins can view admins in same shop"
    - Creates a helper function with SECURITY DEFINER that bypasses RLS
    - Uses the helper function in the policy to avoid recursion
  
  2. Security
    - Admins can view other admins in their shop
    - Super admins can view all admins
    - Individual admins can view their own record
*/

-- Drop the still-recursive policy
DROP POLICY IF EXISTS "Admins can view admins in same shop" ON admins;

-- Create a helper function that bypasses RLS to get the admin's shop_id
CREATE OR REPLACE FUNCTION get_current_admin_shop_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT shop_id 
  FROM admins 
  WHERE auth_user_id = auth.uid() 
  AND is_active = true
  LIMIT 1;
$$;

-- Create a policy that uses the helper function (no recursion because function bypasses RLS)
CREATE POLICY "Admins can view admins in same shop"
  ON admins
  FOR SELECT
  TO authenticated
  USING (shop_id = get_current_admin_shop_id());