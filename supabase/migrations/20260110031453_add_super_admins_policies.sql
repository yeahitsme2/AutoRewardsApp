/*
  # Add Super Admins RLS Policies
  
  1. Changes
    - Add policy for super admins to view their own record
    - This allows the edge function and frontend to verify super admin status
  
  2. Security
    - Super admins can only view their own record
    - No insert/update/delete - these are managed via migrations only
*/

-- Allow super admins to view their own record
CREATE POLICY "Super admins can view their own record"
  ON super_admins FOR SELECT
  TO authenticated
  USING (id = auth.uid());
