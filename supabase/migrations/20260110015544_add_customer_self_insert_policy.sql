/*
  # Allow authenticated users to create their own customer record

  1. Security Changes
    - Add INSERT policy for customers table allowing users to create their own record
    - Policy ensures auth_user_id matches the authenticated user

  2. Notes
    - This enables the signup flow where a new user creates their customer profile
*/

CREATE POLICY "Users can create their own customer record"
  ON customers
  FOR INSERT
  TO authenticated
  WITH CHECK (auth_user_id = auth.uid());
