/*
  # Fix Promotions Policies to Bypass RLS Recursion
  
  1. Problem
    - The helper function still causes recursion because it queries admins table
    - Even with SECURITY DEFINER, RLS is still enforced on the admins table
    - This causes socket hang up errors on UPDATE and DELETE operations
  
  2. Solution
    - Drop the problematic helper function with CASCADE
    - Create separate policies for each operation (SELECT, INSERT, UPDATE, DELETE)
    - Use direct subqueries that check super_admins or admins without helper functions
  
  3. Changes
    - Drop user_is_shop_admin_for_promotion function with CASCADE
    - Create individual policies with inline checks
*/

-- Drop the helper function and its dependent policy
DROP FUNCTION IF EXISTS user_is_shop_admin_for_promotion(uuid) CASCADE;

-- Create separate policies for each operation

-- SELECT: Super admins can see all, shop admins can see their shop's promotions
CREATE POLICY "View promotions"
  ON promotions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM super_admins WHERE super_admins.id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM admins WHERE admins.auth_user_id = auth.uid() AND admins.shop_id = promotions.shop_id)
  );

-- INSERT: Super admins or shop admins can create for their shop
CREATE POLICY "Create promotions"
  ON promotions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM super_admins WHERE super_admins.id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM admins WHERE admins.auth_user_id = auth.uid() AND admins.shop_id = promotions.shop_id)
  );

-- UPDATE: Super admins or shop admins can update their shop's promotions
CREATE POLICY "Update promotions"
  ON promotions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM super_admins WHERE super_admins.id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM admins WHERE admins.auth_user_id = auth.uid() AND admins.shop_id = promotions.shop_id)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM super_admins WHERE super_admins.id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM admins WHERE admins.auth_user_id = auth.uid() AND admins.shop_id = promotions.shop_id)
  );

-- DELETE: Super admins or shop admins can delete their shop's promotions
CREATE POLICY "Delete promotions"
  ON promotions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM super_admins WHERE super_admins.id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM admins WHERE admins.auth_user_id = auth.uid() AND admins.shop_id = promotions.shop_id)
  );
