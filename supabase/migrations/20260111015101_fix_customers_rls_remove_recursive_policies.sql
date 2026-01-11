/*
  # Fix customers RLS policies - remove recursive policies
  
  1. Changes
    - Drops old policies that use is_shop_admin() and get_user_shop_id() helper functions
    - These helper functions query the customers table, creating recursive RLS loops
    - Keeps simplified policies that directly check admins table or auth.uid()
  
  2. Security
    - Admins can manage customers in their shop via admins table
    - Customers can view/update their own records via auth_user_id
    - Super admins can manage all customers
*/

-- Drop recursive policies that use helper functions
DROP POLICY IF EXISTS "Shop admins can view their shop customers" ON customers;
DROP POLICY IF EXISTS "Shop admins can insert their shop customers" ON customers;
DROP POLICY IF EXISTS "Shop admins can update their shop customers" ON customers;
DROP POLICY IF EXISTS "Shop admins can delete their shop customers" ON customers;

-- Keep these non-recursive policies:
-- "Shop admins can manage their shop customers" (ALL) - uses admins table directly
-- "Users can view their own customer record" (SELECT)
-- "Users can update their own customer record" (UPDATE)
-- "Users can create their own customer record" (INSERT)
-- "Super admins can view all customers" (SELECT)
-- "Super admins can insert customers" (INSERT)
-- "Super admins can update customers" (UPDATE)
-- "Super admins can delete customers" (DELETE)