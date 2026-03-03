/*
  # Add Super Admin Delete Policy for Repair Order Items

  1. Changes
    - Add DELETE policy for super admins on repair_order_items table
    - This allows super admins to delete any repair order item

  2. Security
    - Policy restricted to authenticated users in super_admins table
*/

-- Super admins can delete any repair order item
CREATE POLICY "Super admins can delete any repair order items"
  ON repair_order_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.id = auth.uid()
    )
  );
