/*
  # Consolidate Multiple Permissive Policies

  1. Security Improvements
    - Combine multiple permissive policies into single policies
    - Improves policy evaluation performance
    - Makes security rules easier to understand and maintain

  2. Tables Updated
    - appointments: Consolidated SELECT and UPDATE policies
    - customer_promotions: Consolidated UPDATE policies
    - promotions: Consolidated SELECT policies

  3. Policy Logic
    - All policies maintain the same access rules
    - Combined using OR logic where appropriate
    - Optimized with (select auth.uid()) for performance

  4. Changes
    - appointments: 2 SELECT policies → 1, 2 UPDATE policies → 1
    - customer_promotions: 2 UPDATE policies → 1
    - promotions: 2 SELECT policies → 1
*/

-- ============================================
-- APPOINTMENTS TABLE
-- ============================================

-- Consolidate SELECT policies (customers OR admins can view)
DROP POLICY IF EXISTS "Customers can view own appointments" ON appointments;
DROP POLICY IF EXISTS "Admins can view all appointments" ON appointments;

CREATE POLICY "Users can view appointments"
  ON appointments FOR SELECT
  TO authenticated
  USING (
    customer_id = (select auth.uid()) OR is_admin()
  );

-- Consolidate UPDATE policies (customers can update own pending, admins can update all)
DROP POLICY IF EXISTS "Customers can update own pending appointments" ON appointments;
DROP POLICY IF EXISTS "Admins can update all appointments" ON appointments;

CREATE POLICY "Users can update appointments"
  ON appointments FOR UPDATE
  TO authenticated
  USING (
    (customer_id = (select auth.uid()) AND status = 'pending') OR is_admin()
  )
  WITH CHECK (
    (customer_id = (select auth.uid()) AND status = 'pending') OR is_admin()
  );

-- ============================================
-- CUSTOMER_PROMOTIONS TABLE
-- ============================================

-- Consolidate UPDATE policies (customers can update own, admins can update all)
DROP POLICY IF EXISTS "Customers can update own promotions" ON customer_promotions;
DROP POLICY IF EXISTS "Admins can manage customer promotions" ON customer_promotions;

CREATE POLICY "Users can update customer promotions"
  ON customer_promotions FOR UPDATE
  TO authenticated
  USING (
    customer_id = (select auth.uid()) OR is_admin()
  )
  WITH CHECK (
    customer_id = (select auth.uid()) OR is_admin()
  );

-- ============================================
-- PROMOTIONS TABLE
-- ============================================

-- Consolidate SELECT policies (customers can view sent promotions, admins can view all)
DROP POLICY IF EXISTS "Customers can read promotions sent to them" ON promotions;
DROP POLICY IF EXISTS "Admins can view all promotions" ON promotions;

CREATE POLICY "Users can view promotions"
  ON promotions FOR SELECT
  TO authenticated
  USING (
    is_admin() OR 
    id IN (
      SELECT promotion_id 
      FROM customer_promotions 
      WHERE customer_id = (select auth.uid())
    )
  );
