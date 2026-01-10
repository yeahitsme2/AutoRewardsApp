/*
  # Fix Admin View Policy with Security Definer Function

  1. Problem
    - Policy "Admins can view all admins in their shop" queries admins table within admins policy
    - This causes infinite recursion: policy checks -> query admins -> policy checks -> query admins...
    - Results in 0 admins shown and login failures
    
  2. Solution
    - Create a SECURITY DEFINER function to get admin's shop_id that bypasses RLS
    - Update the policy to use this function instead of subquery
    - This breaks the recursion cycle
    
  3. Security
    - SECURITY DEFINER is safe - function only returns shop_id for the authenticated user
    - No user input, no SQL injection risk
    - Only used for authorization checks
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Admins can view all admins in their shop" ON admins;

-- Create helper function to get admin's shop_id with SECURITY DEFINER
CREATE OR REPLACE FUNCTION get_admin_shop_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN (
    SELECT shop_id 
    FROM admins 
    WHERE auth_user_id = auth.uid()
    AND is_active = true
    LIMIT 1
  );
END;
$$;

-- Recreate policy using the security definer function
CREATE POLICY "Admins can view all admins in their shop"
  ON admins FOR SELECT
  TO authenticated
  USING (shop_id = get_admin_shop_id());
