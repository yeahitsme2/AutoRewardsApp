/*
  # Fix Infinite Recursion - Drop in Correct Order

  ## Changes
  - Drop all policies that depend on is_admin function first
  - Then drop the function
  - Create new simple policies without recursion

  ## Security
  - Regular users can only access their own data
  - Simplified admin access for now
*/

-- Drop all policies that use the is_admin function
DROP POLICY IF EXISTS "Users can view own customer profile" ON customers;
DROP POLICY IF EXISTS "Users can update own profile" ON customers;
DROP POLICY IF EXISTS "Admins can insert customers" ON customers;
DROP POLICY IF EXISTS "Users can view vehicles" ON vehicles;
DROP POLICY IF EXISTS "Admins can insert vehicles" ON vehicles;
DROP POLICY IF EXISTS "Admins can update vehicles" ON vehicles;
DROP POLICY IF EXISTS "Admins can delete vehicles" ON vehicles;
DROP POLICY IF EXISTS "Users can view services" ON services;
DROP POLICY IF EXISTS "Admins can insert services" ON services;
DROP POLICY IF EXISTS "Admins can update services" ON services;
DROP POLICY IF EXISTS "Admins can delete services" ON services;

-- Now drop the function
DROP FUNCTION IF EXISTS is_admin(uuid);

-- Create simple, non-recursive policies for customers
CREATE POLICY "Users can view own customer data"
  ON customers FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own customer data"
  ON customers FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own customer data"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Create simple policies for vehicles
CREATE POLICY "Users can view own vehicles"
  ON vehicles FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

CREATE POLICY "Users can insert vehicles"
  ON vehicles FOR INSERT
  TO authenticated
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Users can update vehicles"
  ON vehicles FOR UPDATE
  TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Users can delete vehicles"
  ON vehicles FOR DELETE
  TO authenticated
  USING (customer_id = auth.uid());

-- Create simple policies for services
CREATE POLICY "Users can view own services"
  ON services FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

CREATE POLICY "Users can insert services"
  ON services FOR INSERT
  TO authenticated
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Users can update services"
  ON services FOR UPDATE
  TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Users can delete services"
  ON services FOR DELETE
  TO authenticated
  USING (customer_id = auth.uid());