/*
  # Fix Remaining RLS Performance Issues

  ## Changes Made

  ### 1. Optimize Remaining RLS Policies
  Replace direct auth.uid() calls with (SELECT auth.uid()) in:
  - admins table policies
  - shops table policies (for admins)
  - vehicles admin policies
  - services admin policies
  - appointments admin policies
  - reward_redemptions admin policies

  This prevents the auth.uid() function from being re-evaluated for each row,
  significantly improving query performance at scale.
*/

-- ============================================================================
-- ADMINS TABLE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Admins can view own record" ON admins;
CREATE POLICY "Admins can view own record"
  ON admins FOR SELECT
  TO authenticated
  USING (auth_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins can update own record" ON admins;
CREATE POLICY "Admins can update own record"
  ON admins FOR UPDATE
  TO authenticated
  USING (auth_user_id = (SELECT auth.uid()))
  WITH CHECK (auth_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Super admins can view all admins" ON admins;
CREATE POLICY "Super admins can view all admins"
  ON admins FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Super admins can insert admins" ON admins;
CREATE POLICY "Super admins can insert admins"
  ON admins FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Super admins can update admins" ON admins;
CREATE POLICY "Super admins can update admins"
  ON admins FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.id = (SELECT auth.uid())
    )
  );

-- ============================================================================
-- SHOPS TABLE POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Shop admins can update their shop" ON shops;
CREATE POLICY "Shop admins can update their shop"
  ON shops FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = (SELECT auth.uid())
      AND admins.shop_id = shops.id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = (SELECT auth.uid())
      AND admins.shop_id = shops.id
    )
  );

-- ============================================================================
-- SHOP_SETTINGS TABLE POLICIES  
-- ============================================================================

DROP POLICY IF EXISTS "Shop admins can manage their settings" ON shop_settings;
CREATE POLICY "Shop admins can manage their settings"
  ON shop_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = (SELECT auth.uid())
      AND admins.shop_id = shop_settings.shop_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = (SELECT auth.uid())
      AND admins.shop_id = shop_settings.shop_id
    )
  );

-- ============================================================================
-- VEHICLES TABLE ADMIN POLICIES
-- ============================================================================

DO $do$
BEGIN
  DROP POLICY IF EXISTS "Shop admins can manage their shop vehicles" ON vehicles;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'shop_id'
  ) THEN
    CREATE POLICY "Shop admins can manage their shop vehicles"
      ON vehicles FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM admins
          WHERE admins.auth_user_id = (SELECT auth.uid())
          AND admins.shop_id = vehicles.shop_id
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM admins
          WHERE admins.auth_user_id = (SELECT auth.uid())
          AND admins.shop_id = vehicles.shop_id
        )
      );
  ELSE
    CREATE POLICY "Shop admins can manage their shop vehicles"
      ON vehicles FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM admins
          JOIN customers ON customers.id = vehicles.customer_id
          WHERE admins.auth_user_id = (SELECT auth.uid())
          AND admins.shop_id = customers.shop_id
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM admins
          JOIN customers ON customers.id = vehicles.customer_id
          WHERE admins.auth_user_id = (SELECT auth.uid())
          AND admins.shop_id = customers.shop_id
        )
      );
  END IF;
END
$do$;

-- ============================================================================
-- SERVICES TABLE ADMIN POLICIES
-- ============================================================================

DO $do$
BEGIN
  DROP POLICY IF EXISTS "Shop admins can manage their shop services" ON services;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'shop_id'
  ) THEN
    CREATE POLICY "Shop admins can manage their shop services"
      ON services FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM admins
          WHERE admins.auth_user_id = (SELECT auth.uid())
          AND admins.shop_id = services.shop_id
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM admins
          WHERE admins.auth_user_id = (SELECT auth.uid())
          AND admins.shop_id = services.shop_id
        )
      );
  ELSE
    CREATE POLICY "Shop admins can manage their shop services"
      ON services FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM admins
          JOIN customers ON customers.id = services.customer_id
          WHERE admins.auth_user_id = (SELECT auth.uid())
          AND admins.shop_id = customers.shop_id
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM admins
          JOIN customers ON customers.id = services.customer_id
          WHERE admins.auth_user_id = (SELECT auth.uid())
          AND admins.shop_id = customers.shop_id
        )
      );
  END IF;
END
$do$;

-- ============================================================================
-- APPOINTMENTS TABLE ADMIN POLICIES
-- ============================================================================

DO $do$
BEGIN
  DROP POLICY IF EXISTS "Shop admins can manage their shop appointments" ON appointments;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'shop_id'
  ) THEN
    CREATE POLICY "Shop admins can manage their shop appointments"
      ON appointments FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM admins
          WHERE admins.auth_user_id = (SELECT auth.uid())
          AND admins.shop_id = appointments.shop_id
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM admins
          WHERE admins.auth_user_id = (SELECT auth.uid())
          AND admins.shop_id = appointments.shop_id
        )
      );
  ELSE
    CREATE POLICY "Shop admins can manage their shop appointments"
      ON appointments FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM admins
          JOIN customers ON customers.id = appointments.customer_id
          WHERE admins.auth_user_id = (SELECT auth.uid())
          AND admins.shop_id = customers.shop_id
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM admins
          JOIN customers ON customers.id = appointments.customer_id
          WHERE admins.auth_user_id = (SELECT auth.uid())
          AND admins.shop_id = customers.shop_id
        )
      );
  END IF;
END
$do$;

-- ============================================================================
-- REWARD_REDEMPTIONS TABLE ADMIN POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Shop admins can manage their shop redemptions" ON reward_redemptions;
CREATE POLICY "Shop admins can manage their shop redemptions"
  ON reward_redemptions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = (SELECT auth.uid())
      AND admins.shop_id = reward_redemptions.shop_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = (SELECT auth.uid())
      AND admins.shop_id = reward_redemptions.shop_id
    )
  );

-- ============================================================================
-- PROMOTIONS TABLE ADMIN POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Shop admins can manage their shop promotions" ON promotions;
CREATE POLICY "Shop admins can manage their shop promotions"
  ON promotions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = (SELECT auth.uid())
      AND admins.shop_id = promotions.shop_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = (SELECT auth.uid())
      AND admins.shop_id = promotions.shop_id
    )
  );

-- ============================================================================
-- REWARD_ITEMS TABLE ADMIN POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Shop admins can manage their shop reward items" ON reward_items;
CREATE POLICY "Shop admins can manage their shop reward items"
  ON reward_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = (SELECT auth.uid())
      AND admins.shop_id = reward_items.shop_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = (SELECT auth.uid())
      AND admins.shop_id = reward_items.shop_id
    )
  );

-- ============================================================================
-- CUSTOMER_PROMOTIONS TABLE ADMIN POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Shop admins can manage their shop customer promotions" ON customer_promotions;
CREATE POLICY "Shop admins can manage their shop customer promotions"
  ON customer_promotions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = (SELECT auth.uid())
      AND admins.shop_id = customer_promotions.shop_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = (SELECT auth.uid())
      AND admins.shop_id = customer_promotions.shop_id
    )
  );

-- ============================================================================
-- CUSTOMERS TABLE ADMIN POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Shop admins can manage their shop customers" ON customers;
CREATE POLICY "Shop admins can manage their shop customers"
  ON customers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = (SELECT auth.uid())
      AND admins.shop_id = customers.shop_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = (SELECT auth.uid())
      AND admins.shop_id = customers.shop_id
    )
  );
