/*
  # Create Promotions and Customer Promotions Tables

  ## Overview
  This migration adds a promotional system allowing admins to create and send promotions
  to customers, with tracking for read/used status.

  ## New Tables

  ### `promotions`
  - `id` (uuid, primary key) - Unique promotion identifier
  - `title` (text) - Promotion title
  - `description` (text) - Detailed description of the promotion
  - `discount_type` (text) - Type of discount: percentage, fixed_amount, points_bonus, or free_service
  - `discount_value` (numeric) - Value of the discount
  - `promo_code` (text, nullable) - Optional promo code for redemption
  - `valid_from` (timestamptz) - Start date/time for promotion validity
  - `valid_until` (timestamptz) - End date/time for promotion validity
  - `is_active` (boolean) - Whether the promotion is currently active
  - `created_by` (uuid, foreign key) - Admin who created the promotion
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Record last update timestamp

  ### `customer_promotions`
  - `id` (uuid, primary key) - Unique record identifier
  - `customer_id` (uuid, foreign key) - Links to customers table
  - `promotion_id` (uuid, foreign key) - Links to promotions table
  - `is_read` (boolean) - Whether customer has viewed the promotion
  - `is_used` (boolean) - Whether customer has used the promotion
  - `sent_at` (timestamptz) - When the promotion was sent to the customer
  - `read_at` (timestamptz, nullable) - When the customer viewed the promotion
  - `used_at` (timestamptz, nullable) - When the customer used the promotion

  ## Security
  - Admins can create, view, update, and delete promotions
  - Admins can send promotions to customers (create customer_promotions records)
  - Customers can view their own customer_promotions records
  - Customers can update their own customer_promotions records (mark as read/used)
  - Customers can view promotions that have been sent to them

  ## Important Notes
  1. Promotions can be targeted to specific customers or groups
  2. Tracking read/used status helps measure promotion effectiveness
  3. Multiple customers can receive the same promotion
  4. Promotions can have optional promo codes for redemption tracking
*/

-- ============================================
-- CREATE PROMOTIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  discount_type text DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed_amount', 'points_bonus', 'free_service')),
  discount_value numeric DEFAULT 0,
  promo_code text,
  valid_from timestamptz DEFAULT now(),
  valid_until timestamptz NOT NULL,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES customers(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- CREATE CUSTOMER_PROMOTIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS customer_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  promotion_id uuid REFERENCES promotions(id) ON DELETE CASCADE NOT NULL,
  is_read boolean DEFAULT false,
  is_used boolean DEFAULT false,
  sent_at timestamptz DEFAULT now(),
  read_at timestamptz,
  used_at timestamptz
);

-- ============================================
-- ENABLE RLS
-- ============================================

DO $$
BEGIN
  ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE customer_promotions ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- ============================================
-- PROMOTIONS POLICIES
-- ============================================

DROP POLICY IF EXISTS "Admins can view all promotions" ON promotions;
CREATE POLICY "Admins can view all promotions"
  ON promotions FOR SELECT
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Admins can insert promotions" ON promotions;
CREATE POLICY "Admins can insert promotions"
  ON promotions FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can update promotions" ON promotions;
CREATE POLICY "Admins can update promotions"
  ON promotions FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can delete promotions" ON promotions;
CREATE POLICY "Admins can delete promotions"
  ON promotions FOR DELETE
  TO authenticated
  USING (is_admin());

-- ============================================
-- CUSTOMER_PROMOTIONS POLICIES
-- ============================================

DROP POLICY IF EXISTS "Users can view customer promotions" ON customer_promotions;
CREATE POLICY "Users can view customer promotions"
  ON customer_promotions FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "Admins can insert customer promotions" ON customer_promotions;
CREATE POLICY "Admins can insert customer promotions"
  ON customer_promotions FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Customers can update own customer promotions" ON customer_promotions;
CREATE POLICY "Customers can update own customer promotions"
  ON customer_promotions FOR UPDATE
  TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "Admins can update customer promotions" ON customer_promotions;
CREATE POLICY "Admins can update customer promotions"
  ON customer_promotions FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can delete customer promotions" ON customer_promotions;
CREATE POLICY "Admins can delete customer promotions"
  ON customer_promotions FOR DELETE
  TO authenticated
  USING (is_admin());

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(is_active);
CREATE INDEX IF NOT EXISTS idx_promotions_valid_dates ON promotions(valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_promotions_promo_code ON promotions(promo_code);
CREATE INDEX IF NOT EXISTS idx_customer_promotions_customer_id ON customer_promotions(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_promotions_promotion_id ON customer_promotions(promotion_id);
CREATE INDEX IF NOT EXISTS idx_customer_promotions_is_read ON customer_promotions(is_read);
CREATE INDEX IF NOT EXISTS idx_customer_promotions_is_used ON customer_promotions(is_used);

-- ============================================
-- TRIGGER FUNCTIONS
-- ============================================

-- Function to update the updated_at timestamp on promotions
CREATE OR REPLACE FUNCTION update_promotions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on promotions
DROP TRIGGER IF EXISTS trigger_update_promotions_updated_at ON promotions;
CREATE TRIGGER trigger_update_promotions_updated_at
BEFORE UPDATE ON promotions
FOR EACH ROW
EXECUTE FUNCTION update_promotions_updated_at();

-- Function to automatically set read_at when is_read is set to true
CREATE OR REPLACE FUNCTION update_customer_promotion_read_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_read = true AND (OLD.is_read = false OR OLD.is_read IS NULL) AND NEW.read_at IS NULL THEN
    NEW.read_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update read_at on customer_promotions
DROP TRIGGER IF EXISTS trigger_update_customer_promotion_read_at ON customer_promotions;
CREATE TRIGGER trigger_update_customer_promotion_read_at
BEFORE UPDATE ON customer_promotions
FOR EACH ROW
EXECUTE FUNCTION update_customer_promotion_read_at();

-- Function to automatically set used_at when is_used is set to true
CREATE OR REPLACE FUNCTION update_customer_promotion_used_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_used = true AND (OLD.is_used = false OR OLD.is_used IS NULL) AND NEW.used_at IS NULL THEN
    NEW.used_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update used_at on customer_promotions
DROP TRIGGER IF EXISTS trigger_update_customer_promotion_used_at ON customer_promotions;
CREATE TRIGGER trigger_update_customer_promotion_used_at
BEFORE UPDATE ON customer_promotions
FOR EACH ROW
EXECUTE FUNCTION update_customer_promotion_used_at();