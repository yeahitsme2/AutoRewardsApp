/*
  # Add Admin Update Policy for Shop Settings

  1. Changes
    - Add policy allowing shop admins to update their shop's settings
    - Admins can only update settings for their own shop

  2. Security
    - Restricted to authenticated users who are admins
    - Scoped to their shop_id only
*/

-- Drop existing update policy if it exists
DROP POLICY IF EXISTS "Shop admins can update their shop settings" ON shop_settings;

-- Create policy for admins to update their shop settings
CREATE POLICY "Shop admins can update their shop settings"
  ON shop_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.auth_user_id = auth.uid()
      AND customers.shop_id = shop_settings.shop_id
      AND customers.is_admin = true
      AND customers.is_deactivated = false
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.auth_user_id = auth.uid()
      AND customers.shop_id = shop_settings.shop_id
      AND customers.is_admin = true
      AND customers.is_deactivated = false
    )
  );
