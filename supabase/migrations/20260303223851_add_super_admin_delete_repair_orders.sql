/*
  # Add Super Admin Delete Policy for Repair Orders

  1. Changes
    - Add DELETE policy for super admins on repair_orders table
    - This allows super admins to delete any repair order

  2. Security
    - Policy restricted to authenticated users in super_admins table
*/

-- Super admins can delete any repair order
CREATE POLICY "Super admins can delete any repair orders"
  ON repair_orders FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.id = auth.uid()
    )
  );
