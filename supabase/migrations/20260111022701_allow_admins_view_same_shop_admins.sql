/*
  # Allow admins to view other admins in same shop

  1. Changes
    - Adds a policy to allow admins to view other admins in their shop
    - This enables the User Management page to show all admins in the shop

  2. Security
    - Admins can only view admins in their own shop
    - Does not grant any update or delete permissions
*/

CREATE POLICY "Admins can view other admins in same shop"
  ON admins
  FOR SELECT
  TO authenticated
  USING (
    shop_id IN (
      SELECT shop_id 
      FROM admins 
      WHERE auth_user_id = auth.uid()
    )
  );
