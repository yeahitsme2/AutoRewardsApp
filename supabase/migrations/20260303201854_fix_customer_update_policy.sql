/*
  # Fix Customer Profile Update Policy

  1. Changes
    - Drop the incorrect customer update policy that compares customer.id with auth.uid()
    - Create a correct policy that uses auth_user_id to allow customers to update their profiles

  2. Security
    - Customers can only update their own profile using auth_user_id
    - Admins can still update customers through existing admin policies
*/

-- Drop the incorrect policy
DROP POLICY IF EXISTS "Users can update their own customer record" ON customers;

-- Create the correct policy using auth_user_id
CREATE POLICY "Users can update their own customer record"
  ON customers FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());
