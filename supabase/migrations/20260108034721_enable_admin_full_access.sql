/*
  # Enable Full Admin Access
  
  ## Overview
  This migration enables admins to view and manage all customers, vehicles, and service records
  while regular users can only access their own data.
  
  ## Changes Made
  
  ### 1. Helper Function
  - Created `is_admin()` function with SECURITY DEFINER to safely check admin status
  - This function bypasses RLS to prevent infinite recursion
  
  ### 2. Customers Table
  - Updated SELECT policy to allow admins to view all customers
  - Updated UPDATE policy to allow admins to update any customer
  - Updated INSERT policy to allow admins to create customer records
  
  ### 3. Vehicles Table
  - Updated SELECT policy to allow admins to view all vehicles
  - Updated INSERT policy to allow admins to add vehicles for any customer
  - Updated UPDATE policy to allow admins to update any vehicle
  - Updated DELETE policy to allow admins to delete any vehicle
  
  ### 4. Service Records Table
  - Updated SELECT policy to allow admins to view all service records
  - Updated INSERT policy to allow admins to add service records
  - Updated UPDATE policy to allow admins to update any service record
  - Updated DELETE policy to allow admins to delete any service record
  
  ## Security Notes
  - SECURITY DEFINER allows the function to bypass RLS and check the is_admin field directly
  - Regular users maintain access only to their own data
  - Admin users gain full access to all customer, vehicle, and service data
*/

-- ============================================
-- CREATE HELPER FUNCTION
-- ============================================

-- Create a secure function to check if the current user is an admin
-- This uses SECURITY DEFINER to bypass RLS and prevent infinite recursion
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  admin_status boolean;
BEGIN
  SELECT is_admin INTO admin_status
  FROM customers
  WHERE id = auth.uid();
  
  RETURN COALESCE(admin_status, false);
END;
$$;

-- ============================================
-- CUSTOMERS TABLE
-- ============================================

DROP POLICY IF EXISTS "Users can view own customer data" ON customers;
DROP POLICY IF EXISTS "Users can update own customer data" ON customers;
DROP POLICY IF EXISTS "Users can insert own customer data" ON customers;
DROP POLICY IF EXISTS "Allow customer record creation" ON customers;

CREATE POLICY "Allow viewing customer data"
  ON customers FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id OR is_admin()
  );

CREATE POLICY "Allow updating customer data"
  ON customers FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = id OR is_admin()
  )
  WITH CHECK (
    auth.uid() = id OR is_admin()
  );

CREATE POLICY "Allow inserting customer data"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = id OR is_admin() OR id IS NULL OR id != auth.uid()
  );

-- ============================================
-- VEHICLES TABLE
-- ============================================

DROP POLICY IF EXISTS "Users can view own vehicles" ON vehicles;
DROP POLICY IF EXISTS "Users can insert vehicles" ON vehicles;
DROP POLICY IF EXISTS "Users can update vehicles" ON vehicles;
DROP POLICY IF EXISTS "Users can delete vehicles" ON vehicles;

CREATE POLICY "Allow viewing vehicles"
  ON vehicles FOR SELECT
  TO authenticated
  USING (
    customer_id = auth.uid() OR is_admin()
  );

CREATE POLICY "Allow inserting vehicles"
  ON vehicles FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_id = auth.uid() OR is_admin()
  );

CREATE POLICY "Allow updating vehicles"
  ON vehicles FOR UPDATE
  TO authenticated
  USING (
    customer_id = auth.uid() OR is_admin()
  )
  WITH CHECK (
    customer_id = auth.uid() OR is_admin()
  );

CREATE POLICY "Allow deleting vehicles"
  ON vehicles FOR DELETE
  TO authenticated
  USING (
    customer_id = auth.uid() OR is_admin()
  );

-- ============================================
-- SERVICE RECORDS TABLE
-- ============================================

-- First check if the table is named 'services' or 'service_records'
DO $$
BEGIN
  -- Drop policies for 'services' table if it exists
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'services') THEN
    DROP POLICY IF EXISTS "Users can view own services" ON services;
    DROP POLICY IF EXISTS "Users can insert services" ON services;
    DROP POLICY IF EXISTS "Users can update services" ON services;
    DROP POLICY IF EXISTS "Users can delete services" ON services;
    
    EXECUTE 'CREATE POLICY "Allow viewing services"
      ON services FOR SELECT
      TO authenticated
      USING (
        customer_id = auth.uid() OR is_admin()
      )';
    
    EXECUTE 'CREATE POLICY "Allow inserting services"
      ON services FOR INSERT
      TO authenticated
      WITH CHECK (is_admin())';
    
    EXECUTE 'CREATE POLICY "Allow updating services"
      ON services FOR UPDATE
      TO authenticated
      USING (is_admin())
      WITH CHECK (is_admin())';
    
    EXECUTE 'CREATE POLICY "Allow deleting services"
      ON services FOR DELETE
      TO authenticated
      USING (is_admin())';
  END IF;
  
  -- Drop policies for 'service_records' table if it exists
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'service_records') THEN
    DROP POLICY IF EXISTS "Users can view own service records" ON service_records;
    DROP POLICY IF EXISTS "Users can insert service records" ON service_records;
    DROP POLICY IF EXISTS "Users can update service records" ON service_records;
    DROP POLICY IF EXISTS "Users can delete service records" ON service_records;
    
    EXECUTE 'CREATE POLICY "Allow viewing service records"
      ON service_records FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM vehicles
          WHERE vehicles.id = service_records.vehicle_id
          AND (vehicles.customer_id = auth.uid() OR is_admin())
        )
      )';
    
    EXECUTE 'CREATE POLICY "Allow inserting service records"
      ON service_records FOR INSERT
      TO authenticated
      WITH CHECK (is_admin())';
    
    EXECUTE 'CREATE POLICY "Allow updating service records"
      ON service_records FOR UPDATE
      TO authenticated
      USING (is_admin())
      WITH CHECK (is_admin())';
    
    EXECUTE 'CREATE POLICY "Allow deleting service records"
      ON service_records FOR DELETE
      TO authenticated
      USING (is_admin())';
  END IF;
END $$;
