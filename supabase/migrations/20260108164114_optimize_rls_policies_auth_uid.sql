/*
  # Optimize RLS Policies for Performance

  1. Performance Improvements
    - Wrap all auth.uid() calls with (select auth.uid())
    - This prevents re-evaluation of auth function for each row
    - Significantly improves query performance at scale

  2. Tables Optimized
    - customers: All SELECT, UPDATE, INSERT policies
    - vehicles: All SELECT, INSERT, UPDATE, DELETE policies
    - services: All SELECT policies
    - appointments: All policies
    - customer_promotions: All policies
    - promotions: Customer SELECT policy

  3. Security
    - All policies maintain same security rules
    - Only optimization is wrapping auth.uid() calls
*/

-- ============================================
-- CUSTOMERS TABLE
-- ============================================

DROP POLICY IF EXISTS "Allow viewing customer data" ON customers;
CREATE POLICY "Allow viewing customer data"
  ON customers FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) = id OR is_admin()
  );

DROP POLICY IF EXISTS "Allow updating customer data" ON customers;
CREATE POLICY "Allow updating customer data"
  ON customers FOR UPDATE
  TO authenticated
  USING (
    (select auth.uid()) = id OR is_admin()
  )
  WITH CHECK (
    (select auth.uid()) = id OR is_admin()
  );

DROP POLICY IF EXISTS "Allow customer signup and admin creation" ON customers;
CREATE POLICY "Allow customer signup and admin creation"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = id OR is_admin()
  );

-- Drop old duplicate policies
DROP POLICY IF EXISTS "Users can read own customer data" ON customers;
DROP POLICY IF EXISTS "Users can update own customer data" ON customers;

-- ============================================
-- VEHICLES TABLE
-- ============================================

DROP POLICY IF EXISTS "Allow viewing vehicles" ON vehicles;
CREATE POLICY "Allow viewing vehicles"
  ON vehicles FOR SELECT
  TO authenticated
  USING (
    customer_id = (select auth.uid()) OR is_admin()
  );

DROP POLICY IF EXISTS "Allow inserting vehicles" ON vehicles;
CREATE POLICY "Allow inserting vehicles"
  ON vehicles FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_id = (select auth.uid()) OR is_admin()
  );

DROP POLICY IF EXISTS "Allow updating vehicles" ON vehicles;
CREATE POLICY "Allow updating vehicles"
  ON vehicles FOR UPDATE
  TO authenticated
  USING (
    customer_id = (select auth.uid()) OR is_admin()
  )
  WITH CHECK (
    customer_id = (select auth.uid()) OR is_admin()
  );

DROP POLICY IF EXISTS "Allow deleting vehicles" ON vehicles;
CREATE POLICY "Allow deleting vehicles"
  ON vehicles FOR DELETE
  TO authenticated
  USING (
    customer_id = (select auth.uid()) OR is_admin()
  );

-- ============================================
-- SERVICES TABLE
-- ============================================

DROP POLICY IF EXISTS "Allow viewing services" ON services;
CREATE POLICY "Allow viewing services"
  ON services FOR SELECT
  TO authenticated
  USING (
    customer_id = (select auth.uid()) OR is_admin()
  );

-- ============================================
-- APPOINTMENTS TABLE
-- ============================================

DROP POLICY IF EXISTS "Customers can create appointments" ON appointments;
CREATE POLICY "Customers can create appointments"
  ON appointments FOR INSERT
  TO authenticated
  WITH CHECK (customer_id = (select auth.uid()));

DROP POLICY IF EXISTS "Customers can view own appointments" ON appointments;
CREATE POLICY "Customers can view own appointments"
  ON appointments FOR SELECT
  TO authenticated
  USING (customer_id = (select auth.uid()));

DROP POLICY IF EXISTS "Customers can update own pending appointments" ON appointments;
CREATE POLICY "Customers can update own pending appointments"
  ON appointments FOR UPDATE
  TO authenticated
  USING (customer_id = (select auth.uid()) AND status = 'pending')
  WITH CHECK (customer_id = (select auth.uid()));

DROP POLICY IF EXISTS "Admins can view all appointments" ON appointments;
CREATE POLICY "Admins can view all appointments"
  ON appointments FOR SELECT
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Admins can update all appointments" ON appointments;
CREATE POLICY "Admins can update all appointments"
  ON appointments FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can delete appointments" ON appointments;
CREATE POLICY "Admins can delete appointments"
  ON appointments FOR DELETE
  TO authenticated
  USING (is_admin());

-- ============================================
-- CUSTOMER_PROMOTIONS TABLE
-- ============================================

DROP POLICY IF EXISTS "Users can view customer promotions" ON customer_promotions;
DROP POLICY IF EXISTS "Customers can read own promotions" ON customer_promotions;
CREATE POLICY "Customers can view own promotions"
  ON customer_promotions FOR SELECT
  TO authenticated
  USING (customer_id = (select auth.uid()) OR is_admin());

DROP POLICY IF EXISTS "Customers can update own customer promotions" ON customer_promotions;
DROP POLICY IF EXISTS "Customers can update own promotion status" ON customer_promotions;
CREATE POLICY "Customers can update own promotions"
  ON customer_promotions FOR UPDATE
  TO authenticated
  USING (customer_id = (select auth.uid()))
  WITH CHECK (customer_id = (select auth.uid()));

DROP POLICY IF EXISTS "Admins can update customer promotions" ON customer_promotions;
DROP POLICY IF EXISTS "Admins can update all customer promotions" ON customer_promotions;
CREATE POLICY "Admins can manage customer promotions"
  ON customer_promotions FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can read all customer promotions" ON customer_promotions;

-- ============================================
-- PROMOTIONS TABLE
-- ============================================

DROP POLICY IF EXISTS "Customers can read promotions sent to them" ON promotions;
CREATE POLICY "Customers can read promotions sent to them"
  ON promotions
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT promotion_id 
      FROM customer_promotions 
      WHERE customer_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins can read all promotions" ON promotions;
DROP POLICY IF EXISTS "Admins can view all promotions" ON promotions;
CREATE POLICY "Admins can view all promotions"
  ON promotions FOR SELECT
  TO authenticated
  USING (is_admin());

-- ============================================
-- REWARD_REDEMPTIONS TABLE
-- ============================================

DROP POLICY IF EXISTS "Users can view reward redemptions" ON reward_redemptions;
CREATE POLICY "Users can view reward redemptions"
  ON reward_redemptions FOR SELECT
  TO authenticated
  USING (customer_id = (select auth.uid()) OR is_admin());
