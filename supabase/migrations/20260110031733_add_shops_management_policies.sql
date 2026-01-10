/*
  # Add Shop Management Policies
  
  1. Changes
    - Add policies for super admins to create, update, and delete shops
    - Super admins have full control over all shops
  
  2. Security
    - Only super admins can manage shops
    - Regular users can only view active shops
*/

-- Super admin can create shops
CREATE POLICY "Super admins can create shops"
  ON shops FOR INSERT
  TO authenticated
  WITH CHECK (is_super_admin());

-- Super admin can update shops
CREATE POLICY "Super admins can update shops"
  ON shops FOR UPDATE
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Super admin can delete shops
CREATE POLICY "Super admins can delete shops"
  ON shops FOR DELETE
  TO authenticated
  USING (is_super_admin());

-- Super admin can view all shops (not just active ones)
CREATE POLICY "Super admins can view all shops"
  ON shops FOR SELECT
  TO authenticated
  USING (is_super_admin());
