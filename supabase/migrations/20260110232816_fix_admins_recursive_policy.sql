/*
  # Fix recursive RLS policy on admins table
  
  1. Changes
    - Drop the problematic recursive policy
    - Add a proper policy using a security definer function to avoid recursion
  
  2. Security
    - Admins can still view other admins in their shop
    - Uses a helper function to break the recursion cycle
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Admins can view other admins in their shop" ON admins;

-- Create a security definer function to get the admin's shop_id
CREATE OR REPLACE FUNCTION get_admin_shop_id(user_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT shop_id FROM admins WHERE auth_user_id = user_id LIMIT 1;
$$;

-- Create the policy using the security definer function
CREATE POLICY "Admins can view other admins in their shop"
  ON admins
  FOR SELECT
  TO authenticated
  USING (
    shop_id = get_admin_shop_id(auth.uid())
  );
