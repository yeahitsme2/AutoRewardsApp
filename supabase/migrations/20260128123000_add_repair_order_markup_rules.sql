/*
  # Add repair order markup rules

  1. New table
     - repair_order_markup_rules: per-shop price ranges for parts markup
  2. Security
     - RLS enabled
     - Admins can manage rules for their shop
*/

CREATE TABLE IF NOT EXISTS repair_order_markup_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  min_cost numeric(10,2) NOT NULL DEFAULT 0,
  max_cost numeric(10,2),
  markup_percent numeric(10,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_repair_order_markup_rules_shop_id
  ON repair_order_markup_rules(shop_id);

ALTER TABLE repair_order_markup_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage repair order markup rules" ON repair_order_markup_rules;
CREATE POLICY "Admins can manage repair order markup rules"
  ON repair_order_markup_rules
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM admins
      WHERE admins.auth_user_id = auth.uid()
        AND admins.shop_id = repair_order_markup_rules.shop_id
        AND admins.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM admins
      WHERE admins.auth_user_id = auth.uid()
        AND admins.shop_id = repair_order_markup_rules.shop_id
        AND admins.is_active = true
    )
  );
