/*
  # Allow Admins to Update Their Shop Name

  ## Overview
  This migration adds a policy allowing shop admins to update their shop's name.

  ## Security
  - Only admins of a shop can update that shop's name
  - Uses is_shop_admin function for authorization
*/

-- Allow admins to update their shop
CREATE POLICY "Admins can update own shop"
  ON shops
  FOR UPDATE
  TO authenticated
  USING (is_shop_admin(id))
  WITH CHECK (is_shop_admin(id));
