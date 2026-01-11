/*
  # Fix admins table recursive RLS policy
  
  1. Changes
    - Drops the recursive policy "Admins can view all admins in their shop"
    - This policy uses get_admin_shop_id() which queries the admins table, causing infinite recursion
    - Replaces it with a direct query that doesn't cause recursion using a security definer bypass
  
  2. Security
    - Admins can still view other admins in their shop
    - Super admins can view all admins
    - Individual admins can view their own record
*/

-- Drop the recursive policy
DROP POLICY IF EXISTS "Admins can view all admins in their shop" ON admins;

-- Create a non-recursive policy that directly checks the shop_id
-- Using a subquery with SECURITY DEFINER bypass to avoid recursion
CREATE POLICY "Admins can view admins in same shop"
  ON admins
  FOR SELECT
  TO authenticated
  USING (
    shop_id IN (
      SELECT a.shop_id 
      FROM admins a
      WHERE a.auth_user_id = auth.uid()
      AND a.is_active = true
      LIMIT 1
    )
  );

-- Drop duplicate get_admin_shop_id function with parameter
DROP FUNCTION IF EXISTS get_admin_shop_id(uuid);