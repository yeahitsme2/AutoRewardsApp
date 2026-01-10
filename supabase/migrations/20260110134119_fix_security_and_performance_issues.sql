/*
  # Fix Security and Performance Issues

  ## Changes Made

  ### 1. Add Missing Foreign Key Indexes
  - appointments.vehicle_id
  - customer_promotions.promotion_id
  - reward_redemptions.reward_item_id
  - services.vehicle_id

  ### 2. Remove Unused Indexes
  - Various shop_id indexes that are not being queried
  
  ### 3. Optimize RLS Policies for Performance
  Replace `auth.uid()` with `(SELECT auth.uid())` in all policies
  This prevents re-evaluation for each row and significantly improves query performance at scale

  ## Notes
  - Auth DB Connection Strategy and Leaked Password Protection are Supabase project settings
    that need to be configured in the Supabase dashboard, not via SQL
  - Multiple permissive policies are intentional for the access control model (super admins, 
    shop admins, and regular users each need their own policy)
*/

-- ============================================================================
-- 1. ADD MISSING FOREIGN KEY INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_appointments_vehicle_id ON appointments(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_customer_promotions_promotion_id ON customer_promotions(promotion_id);
CREATE INDEX IF NOT EXISTS idx_reward_redemptions_reward_item_id ON reward_redemptions(reward_item_id);
CREATE INDEX IF NOT EXISTS idx_services_vehicle_id ON services(vehicle_id);

-- ============================================================================
-- 2. REMOVE UNUSED INDEXES
-- ============================================================================

DROP INDEX IF EXISTS idx_vehicles_shop_id;
DROP INDEX IF EXISTS idx_services_shop_id;
DROP INDEX IF EXISTS idx_reward_items_shop_id;
DROP INDEX IF EXISTS idx_reward_redemptions_shop_id;
DROP INDEX IF EXISTS idx_promotions_shop_id;
DROP INDEX IF EXISTS idx_customer_promotions_shop_id;
DROP INDEX IF EXISTS idx_appointments_shop_id;

-- ============================================================================
-- 3. OPTIMIZE ALL RLS POLICIES
-- Replace auth.uid() with (SELECT auth.uid()) to avoid re-evaluation per row
-- ============================================================================

-- SUPER_ADMINS TABLE
DROP POLICY IF EXISTS "Super admins can view all super admins" ON super_admins;
CREATE POLICY "Super admins can view all super admins"
  ON super_admins FOR SELECT
  TO authenticated
  USING (is_super_admin());

-- SHOPS TABLE
DROP POLICY IF EXISTS "Shop admins can view their shop" ON shops;
CREATE POLICY "Shop admins can view their shop"
  ON shops FOR SELECT
  TO authenticated
  USING (id = get_user_shop_id());

-- CUSTOMERS TABLE
DROP POLICY IF EXISTS "Users can view their own customer record" ON customers;
CREATE POLICY "Users can view their own customer record"
  ON customers FOR SELECT
  TO authenticated
  USING (auth_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update their own customer record" ON customers;
CREATE POLICY "Users can update their own customer record"
  ON customers FOR UPDATE
  TO authenticated
  USING (auth_user_id = (SELECT auth.uid()))
  WITH CHECK (auth_user_id = (SELECT auth.uid()));

-- VEHICLES TABLE  
DROP POLICY IF EXISTS "Users can manage their own vehicles" ON vehicles;
CREATE POLICY "Users can manage their own vehicles"
  ON vehicles FOR ALL
  TO authenticated
  USING (customer_id IN (SELECT id FROM customers WHERE auth_user_id = (SELECT auth.uid())))
  WITH CHECK (customer_id IN (SELECT id FROM customers WHERE auth_user_id = (SELECT auth.uid())));

-- SERVICES TABLE
DROP POLICY IF EXISTS "Users can view their own services" ON services;
CREATE POLICY "Users can view their own services"
  ON services FOR SELECT
  TO authenticated
  USING (customer_id IN (SELECT id FROM customers WHERE auth_user_id = (SELECT auth.uid())));

-- REWARD_REDEMPTIONS TABLE
DROP POLICY IF EXISTS "Users can view and create their own redemptions" ON reward_redemptions;
CREATE POLICY "Users can view and create their own redemptions"
  ON reward_redemptions FOR SELECT
  TO authenticated
  USING (customer_id IN (SELECT id FROM customers WHERE auth_user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Users can create redemptions" ON reward_redemptions;
CREATE POLICY "Users can create redemptions"
  ON reward_redemptions FOR INSERT
  TO authenticated
  WITH CHECK (customer_id IN (SELECT id FROM customers WHERE auth_user_id = (SELECT auth.uid())));

-- CUSTOMER_PROMOTIONS TABLE
DROP POLICY IF EXISTS "Users can view their own promotions" ON customer_promotions;
CREATE POLICY "Users can view their own promotions"
  ON customer_promotions FOR SELECT
  TO authenticated
  USING (customer_id IN (SELECT id FROM customers WHERE auth_user_id = (SELECT auth.uid())));

-- APPOINTMENTS TABLE
DROP POLICY IF EXISTS "Users can manage their own appointments" ON appointments;
CREATE POLICY "Users can manage their own appointments"
  ON appointments FOR ALL
  TO authenticated
  USING (customer_id IN (SELECT id FROM customers WHERE auth_user_id = (SELECT auth.uid())))
  WITH CHECK (customer_id IN (SELECT id FROM customers WHERE auth_user_id = (SELECT auth.uid())));
