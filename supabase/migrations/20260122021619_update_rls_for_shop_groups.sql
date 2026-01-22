/*
  # Update RLS Policies for Shop Groups

  1. Changes
    - Update RLS policies on customers, vehicles, services, repair_orders
    - Allow access when shops are in the same shop group
    - This enables multi-location shops to share customer data

  2. Affected Tables
    - customers
    - vehicles
    - services
    - repair_orders
    - appointments
    - reward_redemptions
*/

-- Drop and recreate customers policies to include shop group logic
DROP POLICY IF EXISTS "Admins can view customers in their shop" ON customers;
DROP POLICY IF EXISTS "Admins can manage customers in their shop" ON customers;
DROP POLICY IF EXISTS "Admins can update customers in their shop" ON customers;
DROP POLICY IF EXISTS "Admins can insert customers in their shop" ON customers;

CREATE POLICY "Admins can view customers in their shop or group"
  ON customers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = auth.uid()
      AND (
        admins.shop_id = customers.shop_id
        OR shops_are_linked(admins.shop_id, customers.shop_id)
      )
    )
  );

CREATE POLICY "Admins can insert customers in their shop"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = auth.uid()
      AND admins.shop_id = customers.shop_id
    )
  );

CREATE POLICY "Admins can update customers in their shop or group"
  ON customers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = auth.uid()
      AND (
        admins.shop_id = customers.shop_id
        OR shops_are_linked(admins.shop_id, customers.shop_id)
      )
    )
  );

-- Drop and recreate vehicles policies
DROP POLICY IF EXISTS "Admins can view all vehicles in their shop" ON vehicles;
DROP POLICY IF EXISTS "Admins can manage all vehicles" ON vehicles;
DROP POLICY IF EXISTS "Admins can view vehicles in their shop" ON vehicles;

CREATE POLICY "Admins can view vehicles in their shop or group"
  ON vehicles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      JOIN customers ON customers.id = vehicles.customer_id
      WHERE admins.auth_user_id = auth.uid()
      AND (
        admins.shop_id = customers.shop_id
        OR shops_are_linked(admins.shop_id, customers.shop_id)
      )
    )
  );

CREATE POLICY "Admins can manage vehicles in their shop"
  ON vehicles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      JOIN customers ON customers.id = vehicles.customer_id
      WHERE admins.auth_user_id = auth.uid()
      AND admins.shop_id = customers.shop_id
    )
  );

-- Drop and recreate services policies
DROP POLICY IF EXISTS "Admins can view all services" ON services;
DROP POLICY IF EXISTS "Admins can manage all services" ON services;
DROP POLICY IF EXISTS "Admins can view services in their shop" ON services;

CREATE POLICY "Admins can view services in their shop or group"
  ON services FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      JOIN customers ON customers.id = services.customer_id
      WHERE admins.auth_user_id = auth.uid()
      AND (
        admins.shop_id = customers.shop_id
        OR shops_are_linked(admins.shop_id, customers.shop_id)
      )
    )
  );

CREATE POLICY "Admins can manage services in their shop"
  ON services FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      JOIN customers ON customers.id = services.customer_id
      WHERE admins.auth_user_id = auth.uid()
      AND admins.shop_id = customers.shop_id
    )
  );

-- Drop and recreate repair_orders policies
DROP POLICY IF EXISTS "Admins can view repair orders in their shop" ON repair_orders;
DROP POLICY IF EXISTS "Admins can manage repair orders in their shop" ON repair_orders;
DROP POLICY IF EXISTS "Admins can view repair orders in their shop or group" ON repair_orders;

CREATE POLICY "Admins can view repair orders in their shop or group"
  ON repair_orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = auth.uid()
      AND (
        admins.shop_id = repair_orders.shop_id
        OR shops_are_linked(admins.shop_id, repair_orders.shop_id)
      )
    )
  );

CREATE POLICY "Admins can manage repair orders in their shop"
  ON repair_orders FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = auth.uid()
      AND admins.shop_id = repair_orders.shop_id
    )
  );

-- Drop and recreate appointments policies
DROP POLICY IF EXISTS "Admins can view appointments in their shop" ON appointments;
DROP POLICY IF EXISTS "Admins can manage appointments in their shop" ON appointments;
DROP POLICY IF EXISTS "Admins can view appointments in their shop or group" ON appointments;

CREATE POLICY "Admins can view appointments in their shop or group"
  ON appointments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      JOIN customers ON customers.id = appointments.customer_id
      WHERE admins.auth_user_id = auth.uid()
      AND (
        admins.shop_id = customers.shop_id
        OR shops_are_linked(admins.shop_id, customers.shop_id)
      )
    )
  );

CREATE POLICY "Admins can manage appointments in their shop"
  ON appointments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      JOIN customers ON customers.id = appointments.customer_id
      WHERE admins.auth_user_id = auth.uid()
      AND admins.shop_id = customers.shop_id
    )
  );

-- Drop and recreate reward_redemptions policies
DROP POLICY IF EXISTS "Admins can view reward redemptions" ON reward_redemptions;
DROP POLICY IF EXISTS "Admins can manage reward redemptions" ON reward_redemptions;
DROP POLICY IF EXISTS "Admins can view reward redemptions in their shop or group" ON reward_redemptions;

CREATE POLICY "Admins can view reward redemptions in their shop or group"
  ON reward_redemptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      JOIN customers ON customers.id = reward_redemptions.customer_id
      WHERE admins.auth_user_id = auth.uid()
      AND (
        admins.shop_id = customers.shop_id
        OR shops_are_linked(admins.shop_id, customers.shop_id)
      )
    )
  );

CREATE POLICY "Admins can manage reward redemptions in their shop"
  ON reward_redemptions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      JOIN customers ON customers.id = reward_redemptions.customer_id
      WHERE admins.auth_user_id = auth.uid()
      AND admins.shop_id = customers.shop_id
    )
  );
