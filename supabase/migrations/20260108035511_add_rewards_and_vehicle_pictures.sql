/*
  # Add Rewards System and Vehicle Pictures

  ## Overview
  This migration adds a rewards redemption system and vehicle picture storage capability.

  ## New Tables

  ### `reward_items`
  - `id` (uuid, primary key) - Unique reward identifier
  - `name` (text) - Reward item name
  - `description` (text) - Detailed description of the reward
  - `points_cost` (integer) - Points required to redeem
  - `is_active` (boolean) - Whether the reward is currently available
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Record last update timestamp

  ### `reward_redemptions`
  - `id` (uuid, primary key) - Unique redemption identifier
  - `customer_id` (uuid, foreign key) - Links to customers table
  - `reward_item_id` (uuid, foreign key) - Links to reward_items table
  - `points_spent` (integer) - Points used for this redemption
  - `redeemed_at` (timestamptz) - When the redemption occurred
  - `status` (text) - Redemption status (pending, completed, cancelled)
  - `notes` (text) - Additional notes about the redemption
  - `created_by` (uuid) - Admin who processed the redemption

  ## Table Modifications

  ### `vehicles`
  - Added `picture_url` (text) - URL to vehicle picture

  ## Security
  - Admins can manage reward items
  - Admins can process redemptions
  - Customers can view available rewards
  - Customers can view their own redemption history

  ## Important Notes
  1. Reward redemptions automatically deduct points from customer balance
  2. Vehicle pictures will be stored as URLs (can be Supabase Storage URLs or external URLs)
  3. Reward items can be activated/deactivated by admins
*/

-- ============================================
-- ADD VEHICLE PICTURE FIELD
-- ============================================

-- Add picture_url column to vehicles table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'picture_url'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN picture_url text;
  END IF;
END $$;

-- ============================================
-- CREATE REWARD ITEMS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS reward_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  points_cost integer NOT NULL CHECK (points_cost > 0),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- CREATE REWARD REDEMPTIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS reward_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  reward_item_id uuid REFERENCES reward_items(id) ON DELETE RESTRICT NOT NULL,
  points_spent integer NOT NULL CHECK (points_spent > 0),
  redeemed_at timestamptz DEFAULT now(),
  status text DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled')),
  notes text,
  created_by uuid REFERENCES customers(id),
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- ENABLE RLS
-- ============================================

ALTER TABLE reward_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_redemptions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- REWARD ITEMS POLICIES
-- ============================================

-- Everyone (authenticated) can view active rewards
CREATE POLICY "All users can view active reward items"
  ON reward_items FOR SELECT
  TO authenticated
  USING (is_active = true OR is_admin());

-- Only admins can insert reward items
CREATE POLICY "Admins can insert reward items"
  ON reward_items FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- Only admins can update reward items
CREATE POLICY "Admins can update reward items"
  ON reward_items FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Only admins can delete reward items
CREATE POLICY "Admins can delete reward items"
  ON reward_items FOR DELETE
  TO authenticated
  USING (is_admin());

-- ============================================
-- REWARD REDEMPTIONS POLICIES
-- ============================================

-- Users can view their own redemptions, admins can view all
CREATE POLICY "Users can view reward redemptions"
  ON reward_redemptions FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid() OR is_admin());

-- Only admins can create redemptions
CREATE POLICY "Admins can insert redemptions"
  ON reward_redemptions FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- Only admins can update redemptions
CREATE POLICY "Admins can update redemptions"
  ON reward_redemptions FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Only admins can delete redemptions
CREATE POLICY "Admins can delete redemptions"
  ON reward_redemptions FOR DELETE
  TO authenticated
  USING (is_admin());

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_reward_items_active ON reward_items(is_active);
CREATE INDEX IF NOT EXISTS idx_redemptions_customer_id ON reward_redemptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_reward_item_id ON reward_redemptions(reward_item_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_redeemed_at ON reward_redemptions(redeemed_at DESC);

-- ============================================
-- TRIGGER FUNCTIONS
-- ============================================

-- Function to automatically deduct points when a redemption is completed
CREATE OR REPLACE FUNCTION process_reward_redemption()
RETURNS TRIGGER AS $$
BEGIN
  -- Only deduct points if status is 'completed' and this is a new redemption
  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status != 'completed') THEN
    -- Deduct points from customer
    UPDATE customers
    SET reward_points = reward_points - NEW.points_spent
    WHERE id = NEW.customer_id;
  END IF;
  
  -- If redemption is cancelled, refund the points
  IF TG_OP = 'UPDATE' AND OLD.status = 'completed' AND NEW.status = 'cancelled' THEN
    UPDATE customers
    SET reward_points = reward_points + NEW.points_spent
    WHERE id = NEW.customer_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to process redemptions
DROP TRIGGER IF EXISTS trigger_process_reward_redemption ON reward_redemptions;
CREATE TRIGGER trigger_process_reward_redemption
AFTER INSERT OR UPDATE ON reward_redemptions
FOR EACH ROW
EXECUTE FUNCTION process_reward_redemption();

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on reward_items
DROP TRIGGER IF EXISTS trigger_update_reward_items_updated_at ON reward_items;
CREATE TRIGGER trigger_update_reward_items_updated_at
BEFORE UPDATE ON reward_items
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SEED DATA
-- ============================================

-- Insert some default reward items
INSERT INTO reward_items (name, description, points_cost, is_active) VALUES
  ('Free Oil Change', 'Complimentary standard oil change service', 500, true),
  ('$10 Off Service', '$10 discount on any service over $50', 250, true),
  ('$25 Off Service', '$25 discount on any service over $100', 600, true),
  ('Free Tire Rotation', 'Complimentary tire rotation service', 300, true),
  ('Free Car Wash', 'Exterior car wash service', 100, true),
  ('$50 Off Service', '$50 discount on any service over $200', 1000, true)
ON CONFLICT DO NOTHING;
