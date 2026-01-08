/*
  # Fix Customer Signup Circular Dependency

  1. Problem
    - The INSERT policy on customers table calls is_admin()
    - is_admin() queries the customers table
    - This creates a circular dependency during signup
    - New users can't create their customer record

  2. Solution
    - Split INSERT policy into two separate policies
    - One for users inserting their own record (no admin check needed)
    - One for existing admins inserting other users' records
    - This avoids calling is_admin() during new user signup

  3. Security
    - Users can only insert a record with their own auth.uid()
    - Existing admins can insert records for others
    - No circular dependency since admin check only runs for existing users
*/

-- Drop the existing INSERT policy that has circular dependency
DROP POLICY IF EXISTS "Allow customer signup and admin creation" ON customers;

-- Create policy for users to insert their own record
CREATE POLICY "Users can create own customer record"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Create separate policy for admins to create other users
-- This only runs when the first policy doesn't match
CREATE POLICY "Admins can create customer records"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers
      WHERE id = auth.uid()
      AND is_admin = true
    )
  );
