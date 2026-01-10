/*
  # Fix reward_items RLS policy to use security definer function
  
  1. Changes
    - Create a helper function to check if user is admin of a shop
    - Update reward_items policy to use the helper function
    - This avoids RLS recursion issues when checking admins table
  
  2. Security
    - Shop admins can manage reward items in their shop
    - Uses SECURITY DEFINER to bypass RLS on admins table during check
*/

-- Create a security definer function to check if user is admin of a specific shop
CREATE OR REPLACE FUNCTION is_admin_of_shop_id(check_shop_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admins
    WHERE admins.auth_user_id = auth.uid()
    AND admins.shop_id = check_shop_id
  );
$$;

-- Drop and recreate the reward_items policy
DROP POLICY IF EXISTS "Shop admins can manage their shop reward items" ON reward_items;

CREATE POLICY "Shop admins can manage their shop reward items"
  ON reward_items FOR ALL
  TO authenticated
  USING (is_admin_of_shop_id(shop_id))
  WITH CHECK (is_admin_of_shop_id(shop_id));
