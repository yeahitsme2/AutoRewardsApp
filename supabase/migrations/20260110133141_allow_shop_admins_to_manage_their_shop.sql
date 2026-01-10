/*
  # Allow Shop Admins to Manage Their Shop

  1. Changes
    - Add policy allowing shop admins to view their own shop
    - Add policy allowing shop admins to update their own shop details
    - Shop admins can only modify their own shop, not others

  2. Security
    - Admins can only access and modify shops they are assigned to
    - Super admins retain full access to all shops
*/

-- Add policy for shop admins to view their own shop
CREATE POLICY "Shop admins can view their shop"
  ON shops
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = auth.uid()
      AND admins.shop_id = shops.id
      AND admins.is_active = true
    )
  );

-- Add policy for shop admins to update their own shop
CREATE POLICY "Shop admins can update their shop"
  ON shops
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = auth.uid()
      AND admins.shop_id = shops.id
      AND admins.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = auth.uid()
      AND admins.shop_id = shops.id
      AND admins.is_active = true
    )
  );
