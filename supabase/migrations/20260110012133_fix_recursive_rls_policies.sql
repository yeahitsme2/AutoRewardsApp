/*
  # Fix Recursive RLS Policies

  1. Problem
    - RLS policies on customers table have inline subqueries that read from customers
    - This causes infinite recursion during authentication
    - Results in "Database error querying schema" errors

  2. Solution
    - Replace inline subqueries with SECURITY DEFINER helper functions
    - Helper functions bypass RLS, breaking the recursion cycle

  3. Changes
    - Drop problematic policies with recursive subqueries
    - Recreate policies using is_admin() and get_user_shop_id() functions
*/

-- Drop the problematic policies
DROP POLICY IF EXISTS "Admins can view all shop customers" ON customers;
DROP POLICY IF EXISTS "Admins can create customer records" ON customers;
DROP POLICY IF EXISTS "Admins can update shop customers" ON customers;
DROP POLICY IF EXISTS "Admins can insert shop customers" ON customers;
DROP POLICY IF EXISTS "Allow updating customer data" ON customers;

-- Recreate admin SELECT policy using helper function (no recursion)
CREATE POLICY "Admins can view all shop customers"
  ON customers FOR SELECT
  TO authenticated
  USING (
    shop_id = get_user_shop_id() AND is_admin()
  );

-- Recreate admin INSERT policy using helper function
CREATE POLICY "Admins can insert shop customers"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (
    shop_id = get_user_shop_id() AND is_admin()
  );

-- Recreate admin UPDATE policy using helper function
CREATE POLICY "Admins can update shop customers"
  ON customers FOR UPDATE
  TO authenticated
  USING (shop_id = get_user_shop_id() AND is_admin())
  WITH CHECK (shop_id = get_user_shop_id() AND is_admin());

-- Update the user self-update policy to not use recursive check
CREATE POLICY "Users can update own record"
  ON customers FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
