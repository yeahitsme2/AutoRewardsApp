/*
  # Update RLS Policies for Shop-Based Data Isolation

  ## Overview
  This migration updates all RLS policies to enforce shop-based data isolation.
  Users can only access data from their own shop.

  ## Changes

  ### Customers Table
  - Admins can only view/update customers from their own shop
  - New signups must specify a shop_id

  ### Vehicles Table
  - Filtered through customer's shop_id

  ### Services Table
  - Filtered through customer's shop_id

  ### Other Tables
  - All related tables filtered by shop context

  ## Security
  - Complete data isolation between shops
  - Each shop's data is completely separate
*/

-- Drop and recreate customer policies with shop isolation
DROP POLICY IF EXISTS "Admins can view all customers" ON customers;
CREATE POLICY "Admins can view shop customers"
  ON customers FOR SELECT
  TO authenticated
  USING (
    shop_id = get_user_shop_id()
    AND EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = auth.uid()
      AND c.is_admin = true
    )
  );

DROP POLICY IF EXISTS "Admins can update all customers" ON customers;
CREATE POLICY "Admins can update shop customers"
  ON customers FOR UPDATE
  TO authenticated
  USING (
    shop_id = get_user_shop_id()
    AND EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = auth.uid()
      AND c.is_admin = true
    )
  )
  WITH CHECK (
    shop_id = get_user_shop_id()
    AND EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = auth.uid()
      AND c.is_admin = true
    )
  );

DROP POLICY IF EXISTS "Admins can insert customers" ON customers;
CREATE POLICY "Admins can insert shop customers"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (
    shop_id = get_user_shop_id()
    AND EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = auth.uid()
      AND c.is_admin = true
    )
  );

-- Update vehicles policies with shop isolation
DROP POLICY IF EXISTS "Admins can view all vehicles" ON vehicles;
CREATE POLICY "Admins can view shop vehicles"
  ON vehicles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = auth.uid()
      AND c.is_admin = true
      AND c.shop_id = (SELECT shop_id FROM customers WHERE id = vehicles.customer_id)
    )
  );

DROP POLICY IF EXISTS "Admins can insert vehicles" ON vehicles;
CREATE POLICY "Admins can insert shop vehicles"
  ON vehicles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = auth.uid()
      AND c.is_admin = true
      AND c.shop_id = (SELECT shop_id FROM customers WHERE id = vehicles.customer_id)
    )
  );

DROP POLICY IF EXISTS "Admins can update vehicles" ON vehicles;
CREATE POLICY "Admins can update shop vehicles"
  ON vehicles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = auth.uid()
      AND c.is_admin = true
      AND c.shop_id = (SELECT shop_id FROM customers WHERE id = vehicles.customer_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = auth.uid()
      AND c.is_admin = true
      AND c.shop_id = (SELECT shop_id FROM customers WHERE id = vehicles.customer_id)
    )
  );

DROP POLICY IF EXISTS "Admins can delete vehicles" ON vehicles;
CREATE POLICY "Admins can delete shop vehicles"
  ON vehicles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = auth.uid()
      AND c.is_admin = true
      AND c.shop_id = (SELECT shop_id FROM customers WHERE id = vehicles.customer_id)
    )
  );

-- Update services policies with shop isolation
DROP POLICY IF EXISTS "Admins can view all services" ON services;
CREATE POLICY "Admins can view shop services"
  ON services FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = auth.uid()
      AND c.is_admin = true
      AND c.shop_id = (SELECT shop_id FROM customers WHERE id = services.customer_id)
    )
  );

DROP POLICY IF EXISTS "Admins can insert services" ON services;
CREATE POLICY "Admins can insert shop services"
  ON services FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = auth.uid()
      AND c.is_admin = true
      AND c.shop_id = (SELECT shop_id FROM customers WHERE id = services.customer_id)
    )
  );

DROP POLICY IF EXISTS "Admins can update services" ON services;
CREATE POLICY "Admins can update shop services"
  ON services FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = auth.uid()
      AND c.is_admin = true
      AND c.shop_id = (SELECT shop_id FROM customers WHERE id = services.customer_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = auth.uid()
      AND c.is_admin = true
      AND c.shop_id = (SELECT shop_id FROM customers WHERE id = services.customer_id)
    )
  );

DROP POLICY IF EXISTS "Admins can delete services" ON services;
CREATE POLICY "Admins can delete shop services"
  ON services FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = auth.uid()
      AND c.is_admin = true
      AND c.shop_id = (SELECT shop_id FROM customers WHERE id = services.customer_id)
    )
  );
