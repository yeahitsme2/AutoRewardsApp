/*
  # Fix Customer Self-Read RLS Policy

  This migration ensures users can always read their own customer record
  during login, preventing circular dependency issues with admin checks.

  1. Changes
    - Drop existing conflicting SELECT policies
    - Create simple, direct self-read policy
    - Create separate admin read policy
*/

-- Drop existing SELECT policies that may conflict
DROP POLICY IF EXISTS "Allow viewing customer data" ON customers;
DROP POLICY IF EXISTS "Admins can view shop customers" ON customers;

-- Simple policy: Users can always read their own record
CREATE POLICY "Users can read own customer record"
  ON customers FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Admins can view all customers in their shop
CREATE POLICY "Admins can view all shop customers"
  ON customers FOR SELECT
  TO authenticated
  USING (
    shop_id IN (
      SELECT shop_id FROM customers WHERE id = auth.uid() AND is_admin = true
    )
  );
