/*
  # Fix services RLS policies - remove duplicates
  
  1. Changes
    - Drops old policies that check customers.is_admin (deprecated)
    - Keeps simplified policies that check admins table directly
    - Maintains security by ensuring admins can only access their shop's services
  
  2. Security
    - Admins can manage services in their shop
    - Customers can view their own services
    - All policies use the admins table for admin checks
*/

-- Drop old policies that use customers.is_admin
DROP POLICY IF EXISTS "Admins can view shop services" ON services;
DROP POLICY IF EXISTS "Admins can insert shop services" ON services;
DROP POLICY IF EXISTS "Admins can update shop services" ON services;
DROP POLICY IF EXISTS "Admins can delete shop services" ON services;

-- Keep the newer policies that use the admins table
-- "Shop admins can manage their shop services" (ALL)
-- "Users can view their own services" (SELECT)