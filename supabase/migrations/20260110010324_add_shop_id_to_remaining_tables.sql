/*
  # Add Shop ID to Remaining Tables

  ## Overview
  This migration adds shop_id to tables that need direct shop association
  and updates their RLS policies for complete data isolation.

  ## Changes

  ### reward_items
  - Added shop_id column
  - Updated RLS policies

  ### promotions  
  - Added shop_id column
  - Updated RLS policies

  ## Security
  - All data is now shop-isolated
  - Admins can only manage their own shop's data
*/

-- Add shop_id to reward_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reward_items' AND column_name = 'shop_id'
  ) THEN
    ALTER TABLE reward_items ADD COLUMN shop_id uuid REFERENCES shops(id);
  END IF;
END $$;

-- Add shop_id to promotions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'promotions' AND column_name = 'shop_id'
  ) THEN
    ALTER TABLE promotions ADD COLUMN shop_id uuid REFERENCES shops(id);
  END IF;
END $$;

-- Update existing data with default shop
DO $$
DECLARE
  default_shop_id uuid;
BEGIN
  SELECT id INTO default_shop_id FROM shops WHERE slug = 'default' LIMIT 1;
  
  IF default_shop_id IS NOT NULL THEN
    UPDATE reward_items SET shop_id = default_shop_id WHERE shop_id IS NULL;
    UPDATE promotions SET shop_id = default_shop_id WHERE shop_id IS NULL;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_reward_items_shop_id ON reward_items(shop_id);
CREATE INDEX IF NOT EXISTS idx_promotions_shop_id ON promotions(shop_id);

-- Update reward_items policies
DROP POLICY IF EXISTS "Admins can manage reward items" ON reward_items;
DROP POLICY IF EXISTS "Admins can view reward items" ON reward_items;
DROP POLICY IF EXISTS "Admins can insert reward items" ON reward_items;
DROP POLICY IF EXISTS "Admins can update reward items" ON reward_items;
DROP POLICY IF EXISTS "Admins can delete reward items" ON reward_items;
DROP POLICY IF EXISTS "Customers can view active reward items" ON reward_items;

CREATE POLICY "Admins can view shop reward items"
  ON reward_items FOR SELECT
  TO authenticated
  USING (
    shop_id = get_user_shop_id()
    AND EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = auth.uid()
      AND c.is_admin = true
    )
  );

CREATE POLICY "Customers can view active shop reward items"
  ON reward_items FOR SELECT
  TO authenticated
  USING (
    shop_id = get_user_shop_id()
    AND is_active = true
  );

CREATE POLICY "Admins can insert shop reward items"
  ON reward_items FOR INSERT
  TO authenticated
  WITH CHECK (
    shop_id = get_user_shop_id()
    AND EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = auth.uid()
      AND c.is_admin = true
    )
  );

CREATE POLICY "Admins can update shop reward items"
  ON reward_items FOR UPDATE
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

CREATE POLICY "Admins can delete shop reward items"
  ON reward_items FOR DELETE
  TO authenticated
  USING (
    shop_id = get_user_shop_id()
    AND EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = auth.uid()
      AND c.is_admin = true
    )
  );

-- Update promotions policies
DROP POLICY IF EXISTS "Admins can manage promotions" ON promotions;
DROP POLICY IF EXISTS "Admins can view all promotions" ON promotions;
DROP POLICY IF EXISTS "Admins can view promotions" ON promotions;
DROP POLICY IF EXISTS "Admins can insert promotions" ON promotions;
DROP POLICY IF EXISTS "Admins can update promotions" ON promotions;
DROP POLICY IF EXISTS "Admins can delete promotions" ON promotions;

CREATE POLICY "Admins can view shop promotions"
  ON promotions FOR SELECT
  TO authenticated
  USING (
    shop_id = get_user_shop_id()
    AND EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = auth.uid()
      AND c.is_admin = true
    )
  );

CREATE POLICY "Admins can insert shop promotions"
  ON promotions FOR INSERT
  TO authenticated
  WITH CHECK (
    shop_id = get_user_shop_id()
    AND EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = auth.uid()
      AND c.is_admin = true
    )
  );

CREATE POLICY "Admins can update shop promotions"
  ON promotions FOR UPDATE
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

CREATE POLICY "Admins can delete shop promotions"
  ON promotions FOR DELETE
  TO authenticated
  USING (
    shop_id = get_user_shop_id()
    AND EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = auth.uid()
      AND c.is_admin = true
    )
  );

-- Update reward_redemptions policies for shop isolation
DROP POLICY IF EXISTS "Admins can view all redemptions" ON reward_redemptions;
DROP POLICY IF EXISTS "Admins can insert redemptions" ON reward_redemptions;
DROP POLICY IF EXISTS "Admins can update redemptions" ON reward_redemptions;

CREATE POLICY "Admins can view shop redemptions"
  ON reward_redemptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = auth.uid()
      AND c.is_admin = true
      AND c.shop_id = (SELECT shop_id FROM customers WHERE id = reward_redemptions.customer_id)
    )
  );

CREATE POLICY "Admins can insert shop redemptions"
  ON reward_redemptions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = auth.uid()
      AND c.is_admin = true
      AND c.shop_id = (SELECT shop_id FROM customers WHERE id = reward_redemptions.customer_id)
    )
  );

CREATE POLICY "Admins can update shop redemptions"
  ON reward_redemptions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = auth.uid()
      AND c.is_admin = true
      AND c.shop_id = (SELECT shop_id FROM customers WHERE id = reward_redemptions.customer_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = auth.uid()
      AND c.is_admin = true
      AND c.shop_id = (SELECT shop_id FROM customers WHERE id = reward_redemptions.customer_id)
    )
  );

-- Update appointments policies for shop isolation
DROP POLICY IF EXISTS "Admins can view all appointments" ON appointments;
DROP POLICY IF EXISTS "Admins can update appointments" ON appointments;

CREATE POLICY "Admins can view shop appointments"
  ON appointments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = auth.uid()
      AND c.is_admin = true
      AND c.shop_id = (SELECT shop_id FROM customers WHERE id = appointments.customer_id)
    )
  );

CREATE POLICY "Admins can update shop appointments"
  ON appointments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = auth.uid()
      AND c.is_admin = true
      AND c.shop_id = (SELECT shop_id FROM customers WHERE id = appointments.customer_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = auth.uid()
      AND c.is_admin = true
      AND c.shop_id = (SELECT shop_id FROM customers WHERE id = appointments.customer_id)
    )
  );

-- Update customer_promotions policies for shop isolation
DROP POLICY IF EXISTS "Admins can view all customer promotions" ON customer_promotions;
DROP POLICY IF EXISTS "Admins can insert customer promotions" ON customer_promotions;
DROP POLICY IF EXISTS "Admins can manage customer promotions" ON customer_promotions;

CREATE POLICY "Admins can view shop customer promotions"
  ON customer_promotions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = auth.uid()
      AND c.is_admin = true
      AND c.shop_id = (SELECT shop_id FROM customers WHERE id = customer_promotions.customer_id)
    )
  );

CREATE POLICY "Admins can insert shop customer promotions"
  ON customer_promotions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = auth.uid()
      AND c.is_admin = true
      AND c.shop_id = (SELECT shop_id FROM customers WHERE id = customer_promotions.customer_id)
    )
  );

CREATE POLICY "Admins can update shop customer promotions"
  ON customer_promotions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = auth.uid()
      AND c.is_admin = true
      AND c.shop_id = (SELECT shop_id FROM customers WHERE id = customer_promotions.customer_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = auth.uid()
      AND c.is_admin = true
      AND c.shop_id = (SELECT shop_id FROM customers WHERE id = customer_promotions.customer_id)
    )
  );
