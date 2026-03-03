/*
  # Create Repair Orders System

  1. New Tables
    - `repair_orders`
      - Core repair order tracking with status, totals, signatures
      - Links to shop, customer, vehicle, and appointment
      - Supports customer approval workflow with signatures
      - Tracks timing of notifications and responses

    - `repair_order_items`
      - Individual line items (labor, parts, fees)
      - Customer can approve/decline individual items
      - Tracks pricing, quantities, and tax information
      - Links to DVI recommendations and inventory parts

  2. Security
    - Enable RLS on all tables
    - Admins can manage repair orders in their shop
    - Customers can view their own repair orders
    - Customers can update status and signature on their repair orders
    - Customers can approve/decline individual line items

  3. Status Flow
    - draft → awaiting_approval → approved/declined → inspection_complete → closed
*/

-- ============================================
-- CREATE REPAIR_ORDERS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS repair_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,

  -- Repair Order Info
  ro_number text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'awaiting_approval', 'approved', 'declined', 'inspection_complete', 'closed')),

  -- Notes
  customer_notes text,
  internal_notes text,

  -- Totals
  labor_total numeric(10,2) NOT NULL DEFAULT 0,
  parts_total numeric(10,2) NOT NULL DEFAULT 0,
  fees_total numeric(10,2) NOT NULL DEFAULT 0,
  tax_total numeric(10,2) NOT NULL DEFAULT 0,
  grand_total numeric(10,2) NOT NULL DEFAULT 0,

  -- Shop Supplies
  supplies_amount numeric(10,2) NOT NULL DEFAULT 0,
  supplies_last_calculated_at timestamptz,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  closed_at timestamptz,

  -- Approval Tracking
  approved_by uuid REFERENCES admins(id) ON DELETE SET NULL,
  customer_response_by uuid REFERENCES customers(id) ON DELETE SET NULL,
  customer_approved_at timestamptz,
  customer_declined_at timestamptz,

  -- Notification Tracking
  customer_notified_at timestamptz,
  admin_notified_at timestamptz,

  -- Signature
  customer_signature text,
  customer_signature_name text,
  customer_signature_status text,
  customer_signature_at timestamptz,
  has_signature boolean NOT NULL DEFAULT false,

  -- Temporary Customer/Vehicle Data (for unmatched records)
  temp_customer_name text,
  temp_customer_phone text,
  temp_customer_email text,
  temp_vin text,
  temp_license_plate text,
  temp_vehicle_year integer,
  temp_vehicle_make text,
  temp_vehicle_model text,
  is_matched boolean NOT NULL DEFAULT false
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_repair_orders_shop_id ON repair_orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_repair_orders_customer_id ON repair_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_repair_orders_vehicle_id ON repair_orders(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_repair_orders_appointment_id ON repair_orders(appointment_id);
CREATE INDEX IF NOT EXISTS idx_repair_orders_status ON repair_orders(status);
CREATE INDEX IF NOT EXISTS idx_repair_orders_created_at ON repair_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_repair_orders_ro_number ON repair_orders(shop_id, ro_number);

-- ============================================
-- CREATE REPAIR_ORDER_ITEMS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS repair_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_order_id uuid NOT NULL REFERENCES repair_orders(id) ON DELETE CASCADE,

  -- Item Info
  item_type text NOT NULL CHECK (item_type IN ('labor', 'part', 'fee')),
  description text NOT NULL,

  -- Pricing
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  labor_hours numeric(10,2),
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  taxable boolean NOT NULL DEFAULT false,

  -- Status (for customer approval)
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),

  -- Source Tracking (from DVI or manual)
  source_type text CHECK (source_type IN ('dvi', 'manual')),
  source_dvi_item_id uuid,

  -- Part Info
  part_number text,
  part_source text,
  part_cost numeric(10,2),
  markup_percent numeric(10,2),

  -- Labor Info
  parent_item_id uuid REFERENCES repair_order_items(id) ON DELETE CASCADE,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_repair_order_items_repair_order_id ON repair_order_items(repair_order_id);
CREATE INDEX IF NOT EXISTS idx_repair_order_items_item_type ON repair_order_items(item_type);
CREATE INDEX IF NOT EXISTS idx_repair_order_items_status ON repair_order_items(status);
CREATE INDEX IF NOT EXISTS idx_repair_order_items_parent_id ON repair_order_items(parent_item_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE repair_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_order_items ENABLE ROW LEVEL SECURITY;

-- Repair Orders Policies

-- Admins can view repair orders in their shop
CREATE POLICY "Admins can view shop repair orders"
  ON repair_orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = auth.uid()
        AND admins.shop_id = repair_orders.shop_id
        AND admins.is_active = true
    )
  );

-- Admins can create repair orders in their shop
CREATE POLICY "Admins can create shop repair orders"
  ON repair_orders FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = auth.uid()
        AND admins.shop_id = repair_orders.shop_id
        AND admins.is_active = true
    )
  );

-- Admins can update repair orders in their shop
CREATE POLICY "Admins can update shop repair orders"
  ON repair_orders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = auth.uid()
        AND admins.shop_id = repair_orders.shop_id
        AND admins.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = auth.uid()
        AND admins.shop_id = repair_orders.shop_id
        AND admins.is_active = true
    )
  );

-- Admins can delete repair orders in their shop
CREATE POLICY "Admins can delete shop repair orders"
  ON repair_orders FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.auth_user_id = auth.uid()
        AND admins.shop_id = repair_orders.shop_id
        AND admins.is_active = true
    )
  );

-- Customers can view their own repair orders
CREATE POLICY "Customers can view own repair orders"
  ON repair_orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.auth_user_id = auth.uid()
        AND customers.id = repair_orders.customer_id
    )
  );

-- Customers can update their own repair orders (for approval/decline with signature)
CREATE POLICY "Customers can update own repair orders"
  ON repair_orders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.auth_user_id = auth.uid()
        AND customers.id = repair_orders.customer_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.auth_user_id = auth.uid()
        AND customers.id = repair_orders.customer_id
    )
  );

-- Repair Order Items Policies

-- Admins can view all items for repair orders in their shop
CREATE POLICY "Admins can view shop repair order items"
  ON repair_order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM repair_orders ro
      JOIN admins ON admins.shop_id = ro.shop_id
      WHERE ro.id = repair_order_items.repair_order_id
        AND admins.auth_user_id = auth.uid()
        AND admins.is_active = true
    )
  );

-- Admins can create items for repair orders in their shop
CREATE POLICY "Admins can create shop repair order items"
  ON repair_order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM repair_orders ro
      JOIN admins ON admins.shop_id = ro.shop_id
      WHERE ro.id = repair_order_items.repair_order_id
        AND admins.auth_user_id = auth.uid()
        AND admins.is_active = true
    )
  );

-- Admins can update items for repair orders in their shop
CREATE POLICY "Admins can update shop repair order items"
  ON repair_order_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM repair_orders ro
      JOIN admins ON admins.shop_id = ro.shop_id
      WHERE ro.id = repair_order_items.repair_order_id
        AND admins.auth_user_id = auth.uid()
        AND admins.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM repair_orders ro
      JOIN admins ON admins.shop_id = ro.shop_id
      WHERE ro.id = repair_order_items.repair_order_id
        AND admins.auth_user_id = auth.uid()
        AND admins.is_active = true
    )
  );

-- Admins can delete items from repair orders in their shop
CREATE POLICY "Admins can delete shop repair order items"
  ON repair_order_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM repair_orders ro
      JOIN admins ON admins.shop_id = ro.shop_id
      WHERE ro.id = repair_order_items.repair_order_id
        AND admins.auth_user_id = auth.uid()
        AND admins.is_active = true
    )
  );

-- Customers can view items for their own repair orders
CREATE POLICY "Customers can view own repair order items"
  ON repair_order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM repair_orders ro
      JOIN customers c ON c.id = ro.customer_id
      WHERE ro.id = repair_order_items.repair_order_id
        AND c.auth_user_id = auth.uid()
    )
  );

-- Customers can update items for their own repair orders (approve/decline)
CREATE POLICY "Customers can update own repair order items"
  ON repair_order_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM repair_orders ro
      JOIN customers c ON c.id = ro.customer_id
      WHERE ro.id = repair_order_items.repair_order_id
        AND c.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM repair_orders ro
      JOIN customers c ON c.id = ro.customer_id
      WHERE ro.id = repair_order_items.repair_order_id
        AND c.auth_user_id = auth.uid()
    )
    AND status IN ('approved', 'declined', 'pending')
  );
