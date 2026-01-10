/*
  # Fix Promotions RLS Recursion Issue
  
  1. Problem
    - The promotions table RLS policy queries the admins table with a subquery
    - The admins table has its own RLS policies that can cause recursion
    - This causes update and delete operations to fail
  
  2. Solution
    - Create a SECURITY DEFINER function that bypasses RLS to check admin status
    - Update promotions policies to use this function instead of direct subqueries
  
  3. Changes
    - Create `user_is_shop_admin_for_promotion` helper function with SECURITY DEFINER
    - Drop and recreate the promotions policy using the new function
*/

-- Create a helper function that checks if the current user is an admin for a given shop
-- Using SECURITY DEFINER to bypass RLS and prevent recursion
CREATE OR REPLACE FUNCTION user_is_shop_admin_for_promotion(check_shop_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM admins 
    WHERE admins.auth_user_id = auth.uid() 
    AND admins.shop_id = check_shop_id
  );
END;
$$;

-- Drop the existing policy
DROP POLICY IF EXISTS "Shop admins can manage their shop promotions" ON promotions;

-- Recreate the policy using the new helper function
CREATE POLICY "Shop admins can manage promotions"
  ON promotions
  FOR ALL
  TO authenticated
  USING (user_is_shop_admin_for_promotion(shop_id))
  WITH CHECK (user_is_shop_admin_for_promotion(shop_id));
