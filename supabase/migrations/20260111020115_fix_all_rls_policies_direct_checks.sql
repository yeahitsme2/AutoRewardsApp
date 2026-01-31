/*
  # Fix all RLS policies to use direct admin checks
  
  1. Changes
    - Updates services, reward_items, promotions, and other tables
    - Replaces is_admin_for_shop() with direct subquery
    - Ensures all policies can work without recursive admin table queries
  
  2. Security
    - Maintains same security model
    - Shop admins can only manage data in their shop
    - Customers can still access their own data
*/

-- ========================================
-- SERVICES TABLE
-- ========================================

DROP POLICY IF EXISTS "Shop admins can manage their shop services" ON services;

DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'shop_id'
  ) THEN
    CREATE POLICY "Shop admins can view services"
      ON services FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM admins
          WHERE admins.auth_user_id = auth.uid()
          AND admins.shop_id = services.shop_id
          AND admins.is_active = true
        )
      );

    CREATE POLICY "Shop admins can insert services"
      ON services FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM admins
          WHERE admins.auth_user_id = auth.uid()
          AND admins.shop_id = services.shop_id
          AND admins.is_active = true
        )
      );

    CREATE POLICY "Shop admins can update services"
      ON services FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM admins
          WHERE admins.auth_user_id = auth.uid()
          AND admins.shop_id = services.shop_id
          AND admins.is_active = true
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM admins
          WHERE admins.auth_user_id = auth.uid()
          AND admins.shop_id = services.shop_id
          AND admins.is_active = true
        )
      );

    CREATE POLICY "Shop admins can delete services"
      ON services FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM admins
          WHERE admins.auth_user_id = auth.uid()
          AND admins.shop_id = services.shop_id
          AND admins.is_active = true
        )
      );
  ELSE
    CREATE POLICY "Shop admins can view services"
      ON services FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM admins
          JOIN customers ON customers.id = services.customer_id
          WHERE admins.auth_user_id = auth.uid()
          AND admins.shop_id = customers.shop_id
          AND admins.is_active = true
        )
      );

    CREATE POLICY "Shop admins can insert services"
      ON services FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM admins
          JOIN customers ON customers.id = services.customer_id
          WHERE admins.auth_user_id = auth.uid()
          AND admins.shop_id = customers.shop_id
          AND admins.is_active = true
        )
      );

    CREATE POLICY "Shop admins can update services"
      ON services FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM admins
          JOIN customers ON customers.id = services.customer_id
          WHERE admins.auth_user_id = auth.uid()
          AND admins.shop_id = customers.shop_id
          AND admins.is_active = true
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM admins
          JOIN customers ON customers.id = services.customer_id
          WHERE admins.auth_user_id = auth.uid()
          AND admins.shop_id = customers.shop_id
          AND admins.is_active = true
        )
      );

    CREATE POLICY "Shop admins can delete services"
      ON services FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM admins
          JOIN customers ON customers.id = services.customer_id
          WHERE admins.auth_user_id = auth.uid()
          AND admins.shop_id = customers.shop_id
          AND admins.is_active = true
        )
      );
  END IF;
END
$do$;

-- ========================================
-- REWARD_ITEMS TABLE
-- ========================================

DROP POLICY IF EXISTS "Shop admins can manage their shop reward items" ON reward_items;

CREATE POLICY "Shop admins can view reward items"
  ON reward_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = auth.uid()
      AND admins.shop_id = reward_items.shop_id
      AND admins.is_active = true
    )
  );

CREATE POLICY "Shop admins can insert reward items"
  ON reward_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = auth.uid()
      AND admins.shop_id = reward_items.shop_id
      AND admins.is_active = true
    )
  );

CREATE POLICY "Shop admins can update reward items"
  ON reward_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = auth.uid()
      AND admins.shop_id = reward_items.shop_id
      AND admins.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = auth.uid()
      AND admins.shop_id = reward_items.shop_id
      AND admins.is_active = true
    )
  );

CREATE POLICY "Shop admins can delete reward items"
  ON reward_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = auth.uid()
      AND admins.shop_id = reward_items.shop_id
      AND admins.is_active = true
    )
  );

-- ========================================
-- PROMOTIONS TABLE
-- ========================================

DROP POLICY IF EXISTS "Shop admins can manage their shop promotions" ON promotions;

CREATE POLICY "Shop admins can view promotions"
  ON promotions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = auth.uid()
      AND admins.shop_id = promotions.shop_id
      AND admins.is_active = true
    )
  );

CREATE POLICY "Shop admins can insert promotions"
  ON promotions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = auth.uid()
      AND admins.shop_id = promotions.shop_id
      AND admins.is_active = true
    )
  );

CREATE POLICY "Shop admins can update promotions"
  ON promotions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = auth.uid()
      AND admins.shop_id = promotions.shop_id
      AND admins.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = auth.uid()
      AND admins.shop_id = promotions.shop_id
      AND admins.is_active = true
    )
  );

CREATE POLICY "Shop admins can delete promotions"
  ON promotions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = auth.uid()
      AND admins.shop_id = promotions.shop_id
      AND admins.is_active = true
    )
  );

-- ========================================
-- SHOP_SETTINGS TABLE
-- ========================================

DROP POLICY IF EXISTS "Shop admins can view their shop settings" ON shop_settings;
DROP POLICY IF EXISTS "Shop admins can update their shop settings" ON shop_settings;

CREATE POLICY "Shop admins can view their shop settings"
  ON shop_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = auth.uid()
      AND admins.shop_id = shop_settings.shop_id
      AND admins.is_active = true
    )
  );

CREATE POLICY "Shop admins can update their shop settings"
  ON shop_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = auth.uid()
      AND admins.shop_id = shop_settings.shop_id
      AND admins.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = auth.uid()
      AND admins.shop_id = shop_settings.shop_id
      AND admins.is_active = true
    )
  );

-- ========================================
-- APPOINTMENTS TABLE
-- ========================================

DROP POLICY IF EXISTS "Shop admins can manage their shop appointments" ON appointments;

DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'shop_id'
  ) THEN
    CREATE POLICY "Shop admins can view appointments"
      ON appointments FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM admins
          WHERE admins.auth_user_id = auth.uid()
          AND admins.shop_id = appointments.shop_id
          AND admins.is_active = true
        )
      );

    CREATE POLICY "Shop admins can insert appointments"
      ON appointments FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM admins
          WHERE admins.auth_user_id = auth.uid()
          AND admins.shop_id = appointments.shop_id
          AND admins.is_active = true
        )
      );

    CREATE POLICY "Shop admins can update appointments"
      ON appointments FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM admins
          WHERE admins.auth_user_id = auth.uid()
          AND admins.shop_id = appointments.shop_id
          AND admins.is_active = true
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM admins
          WHERE admins.auth_user_id = auth.uid()
          AND admins.shop_id = appointments.shop_id
          AND admins.is_active = true
        )
      );

    CREATE POLICY "Shop admins can delete appointments"
      ON appointments FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM admins
          WHERE admins.auth_user_id = auth.uid()
          AND admins.shop_id = appointments.shop_id
          AND admins.is_active = true
        )
      );
  ELSE
    CREATE POLICY "Shop admins can view appointments"
      ON appointments FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM admins
          JOIN customers ON customers.id = appointments.customer_id
          WHERE admins.auth_user_id = auth.uid()
          AND admins.shop_id = customers.shop_id
          AND admins.is_active = true
        )
      );

    CREATE POLICY "Shop admins can insert appointments"
      ON appointments FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM admins
          JOIN customers ON customers.id = appointments.customer_id
          WHERE admins.auth_user_id = auth.uid()
          AND admins.shop_id = customers.shop_id
          AND admins.is_active = true
        )
      );

    CREATE POLICY "Shop admins can update appointments"
      ON appointments FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM admins
          JOIN customers ON customers.id = appointments.customer_id
          WHERE admins.auth_user_id = auth.uid()
          AND admins.shop_id = customers.shop_id
          AND admins.is_active = true
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM admins
          JOIN customers ON customers.id = appointments.customer_id
          WHERE admins.auth_user_id = auth.uid()
          AND admins.shop_id = customers.shop_id
          AND admins.is_active = true
        )
      );

    CREATE POLICY "Shop admins can delete appointments"
      ON appointments FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM admins
          JOIN customers ON customers.id = appointments.customer_id
          WHERE admins.auth_user_id = auth.uid()
          AND admins.shop_id = customers.shop_id
          AND admins.is_active = true
        )
      );
  END IF;
END
$do$;

-- ========================================
-- CUSTOMERS TABLE
-- ========================================

DROP POLICY IF EXISTS "Shop admins can manage their shop customers" ON customers;

CREATE POLICY "Shop admins can view customers"
  ON customers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = auth.uid()
      AND admins.shop_id = customers.shop_id
      AND admins.is_active = true
    )
  );

CREATE POLICY "Shop admins can insert customers"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = auth.uid()
      AND admins.shop_id = customers.shop_id
      AND admins.is_active = true
    )
  );

CREATE POLICY "Shop admins can update customers"
  ON customers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = auth.uid()
      AND admins.shop_id = customers.shop_id
      AND admins.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = auth.uid()
      AND admins.shop_id = customers.shop_id
      AND admins.is_active = true
    )
  );

CREATE POLICY "Shop admins can delete customers"
  ON customers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = auth.uid()
      AND admins.shop_id = customers.shop_id
      AND admins.is_active = true
    )
  );
