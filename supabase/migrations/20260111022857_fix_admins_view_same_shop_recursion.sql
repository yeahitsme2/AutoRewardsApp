/*
  # Fix RLS recursion issue for admins viewing same shop

  1. Problem
    - The policy to allow admins to view other admins creates RLS recursion
    - Querying admins table within RLS policy causes infinite loop

  2. Solution
    - Create a SECURITY DEFINER function to get admin's shop_id without RLS
    - Update the policy to use this function

  3. Security
    - Function only returns shop_id for the authenticated user
    - No additional data exposure
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Admins can view other admins in same shop" ON admins;

-- Create helper function to get current admin's shop_id
CREATE OR REPLACE FUNCTION get_admin_shop_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT shop_id 
  FROM admins 
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;

-- Create new policy using the helper function
CREATE POLICY "Admins can view other admins in same shop"
  ON admins
  FOR SELECT
  TO authenticated
  USING (shop_id = get_admin_shop_id());
