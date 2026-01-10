/*
  # Fix Admins Table Policies to Prevent Recursion
  
  1. Problem
    - The policy "Admins can view other admins in their shop" uses get_admin_shop_id()
    - This function queries the admins table, which triggers RLS, causing infinite recursion
    - When promotions policies query admins table, they trigger this recursive policy
  
  2. Solution
    - Drop the problematic policy that uses get_admin_shop_id()
    - Keep only the simple policies that don't cause recursion:
      - "Admins can view own record" (uses auth.uid() directly)
      - "Super admins can view all admins" (queries super_admins, not admins)
  
  3. Changes
    - Drop "Admins can view other admins in their shop" policy
    - This prevents recursion while still allowing admins to view their own record
    - Super admins can still view all admins
*/

-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "Admins can view other admins in their shop" ON admins;
