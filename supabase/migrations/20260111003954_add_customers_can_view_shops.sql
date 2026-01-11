/*
  # Allow Customers to View Shops

  1. Problem
    - Customers also need to view their shop
    - Currently only super admins, admins, and anon users have shop view policies
    
  2. Solution
    - Add policy for customers to view their associated shop
    - Uses existing get_user_shop_id() function which queries customers table
    
  3. Security
    - Customers can only see their own shop
    - Maintains proper tenant isolation
*/

-- Allow customers to view their shop
CREATE POLICY "Customers can view their shop"
  ON shops FOR SELECT
  TO authenticated
  USING (id = get_user_shop_id());
