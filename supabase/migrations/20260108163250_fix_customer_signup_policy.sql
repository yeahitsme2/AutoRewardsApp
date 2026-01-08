/*
  # Fix Customer Signup Policy

  1. Changes
    - Update INSERT policy on customers table to properly allow signup
    - Users can insert their own customer record (when id matches auth.uid())
    - Admins can insert customer records for anyone
    - Removes confusing permissive policy that allowed anyone to insert any record

  2. Security
    - Maintains RLS protection
    - Only authenticated users can insert
    - Users can only insert their own record unless they're an admin
*/

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Allow inserting customer data" ON customers;

-- Create clear, secure INSERT policy
CREATE POLICY "Allow customer signup and admin creation"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = id OR is_admin()
  );
