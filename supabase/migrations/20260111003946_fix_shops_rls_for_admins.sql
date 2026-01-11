/*
  # Fix Shops RLS for Admins

  1. Problem
    - Policy "Shop admins can view their shop" uses get_user_shop_id() which queries customers table
    - Admins are in the admins table, not customers table
    - This causes shop queries to fail for admins, resulting in blank white screen
    
  2. Solution
    - Drop the problematic policy
    - Create new policy that checks admins table directly with SECURITY DEFINER function
    - This allows admins to properly load their shop data
    
  3. Security
    - Maintains proper isolation - admins can only see their own shop
    - Uses SECURITY DEFINER to prevent RLS recursion
*/

-- Drop the old policy
DROP POLICY IF EXISTS "Shop admins can view their shop" ON shops;

-- Create helper function to get shop_id from admins table
CREATE OR REPLACE FUNCTION get_admin_shop_id_from_table()
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

-- Create new policy using the correct function
CREATE POLICY "Admins can view their shop"
  ON shops FOR SELECT
  TO authenticated
  USING (id = get_admin_shop_id_from_table());
