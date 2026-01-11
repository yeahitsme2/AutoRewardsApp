/*
  # Remove recursive policy from admins table
  
  1. Changes
    - Drops "Admins can view admins in same shop" policy
    - This policy uses get_current_admin_shop_id() which queries admins table
    - Creates infinite recursion when SECURITY DEFINER functions query admins
  
  2. Security
    - Admins can still view their own record
    - Super admins can still view all admins
    - SECURITY DEFINER functions can now query admins without recursion
  
  3. Note
    - Admins viewing other admins in their shop should be done at application level
    - or through a dedicated endpoint/view if needed
*/

-- Drop the recursive policy that's causing the infinite loop
DROP POLICY IF EXISTS "Admins can view admins in same shop" ON admins;
