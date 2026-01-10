/*
  # Fix Shop Settings RLS for Admins Table

  1. Changes
    - Update shop_settings RLS policies to use admins table instead of customers.is_admin
    - Allow shop admins from the admins table to update their shop's settings
    - Keep existing super admin and read policies

  2. Security
    - Admins can only update settings for their own shop
    - Super admins can update any shop's settings
    - All users can read settings for branding purposes
*/

-- Drop existing update policies that check customers table
DROP POLICY IF EXISTS "Shop admins can update their shop settings" ON shop_settings;
DROP POLICY IF EXISTS "Shop admins can manage their settings" ON shop_settings;

-- Create new policy for admins table
CREATE POLICY "Shop admins can update their shop settings"
  ON shop_settings
  FOR UPDATE
  TO authenticated
  USING (
    -- Super admins can update any settings
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.id = auth.uid()
    )
    OR
    -- Shop admins can update their own shop's settings
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = auth.uid()
      AND admins.shop_id = shop_settings.shop_id
      AND admins.is_active = true
    )
  )
  WITH CHECK (
    -- Super admins can update any settings
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.id = auth.uid()
    )
    OR
    -- Shop admins can update their own shop's settings
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = auth.uid()
      AND admins.shop_id = shop_settings.shop_id
      AND admins.is_active = true
    )
  );
