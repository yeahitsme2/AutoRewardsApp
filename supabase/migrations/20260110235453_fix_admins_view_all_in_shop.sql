/*
  # Fix Admin Management - Allow Admins to View All Admins in Their Shop

  1. Problem
    - Previous migration removed "Admins can view other admins in their shop" policy to prevent recursion
    - Now admins can only see themselves in the admin management page
    
  2. Solution
    - Restore the policy but without using get_admin_shop_id() function
    - Use a direct subquery instead to avoid recursion
    - Check shop_id by joining admins table directly with WHERE clause
    
  3. Security
    - Admins can only view admins in the same shop
    - Policy uses a simple subquery that won't trigger recursive RLS checks
*/

-- Allow admins to view all admins in their shop
CREATE POLICY "Admins can view all admins in their shop"
  ON admins FOR SELECT
  TO authenticated
  USING (
    shop_id IN (
      SELECT a.shop_id
      FROM admins a
      WHERE a.auth_user_id = auth.uid()
      AND a.is_active = true
    )
  );
