/*
  # Restore Admin Access Policies
  
  1. Changes
    - Add back super admin access to customers table
    - Add back shop admin access to customers table
    - Helper functions are now SECURITY DEFINER so they won't cause recursion
  
  2. Security
    - Super admins can do anything
    - Shop admins can manage their shop's customers
    - Regular users can only see their own record
*/

-- Super admin policies (full access)
CREATE POLICY "Super admins can view all customers"
  ON customers FOR SELECT
  TO authenticated
  USING (is_super_admin());

CREATE POLICY "Super admins can insert customers"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can update customers"
  ON customers FOR UPDATE
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can delete customers"
  ON customers FOR DELETE
  TO authenticated
  USING (is_super_admin());

-- Shop admin policies (shop-scoped access)
CREATE POLICY "Shop admins can view their shop customers"
  ON customers FOR SELECT
  TO authenticated
  USING (is_shop_admin() AND shop_id = get_user_shop_id());

CREATE POLICY "Shop admins can insert their shop customers"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (is_shop_admin() AND shop_id = get_user_shop_id());

CREATE POLICY "Shop admins can update their shop customers"
  ON customers FOR UPDATE
  TO authenticated
  USING (is_shop_admin() AND shop_id = get_user_shop_id())
  WITH CHECK (is_shop_admin() AND shop_id = get_user_shop_id());

CREATE POLICY "Shop admins can delete their shop customers"
  ON customers FOR DELETE
  TO authenticated
  USING (is_shop_admin() AND shop_id = get_user_shop_id());
