/*
  # Add repair orders table

  1. New Tables
    - `repair_orders`
      - `id` (uuid, primary key)
      - `shop_id` (uuid, foreign key to shops)
      - `customer_id` (uuid, foreign key to customers)
      - `vehicle_id` (uuid, foreign key to vehicles, nullable)
      - `service_date` (date) - when the service was performed
      - `file_url` (text) - URL to the PDF document in storage
      - `total_amount` (decimal) - total repair order amount
      - `parts_cost` (decimal, nullable) - parts cost
      - `labor_cost` (decimal, nullable) - labor cost
      - `service_writer` (text, nullable) - name of service writer
      - `notes` (text, nullable) - additional notes or description
      - `created_at` (timestamptz) - when record was created
      - `updated_at` (timestamptz) - when record was last updated

  2. Security
    - Enable RLS on `repair_orders` table
    - Admins can view and manage repair orders in their shop
    - Customers can view their own repair orders
*/

-- Create repair_orders table
CREATE TABLE IF NOT EXISTS repair_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  service_date date NOT NULL DEFAULT CURRENT_DATE,
  file_url text NOT NULL,
  total_amount decimal(10, 2) DEFAULT 0,
  parts_cost decimal(10, 2) DEFAULT 0,
  labor_cost decimal(10, 2) DEFAULT 0,
  service_writer text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_repair_orders_shop_id ON repair_orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_repair_orders_customer_id ON repair_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_repair_orders_vehicle_id ON repair_orders(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_repair_orders_service_date ON repair_orders(service_date DESC);

-- Enable RLS
ALTER TABLE repair_orders ENABLE ROW LEVEL SECURITY;

-- Admins can view repair orders in their shop
CREATE POLICY "Admins can view repair orders in their shop"
  ON repair_orders FOR SELECT
  TO authenticated
  USING (is_admin_for_shop_secure(shop_id));

-- Admins can create repair orders in their shop
CREATE POLICY "Admins can create repair orders in their shop"
  ON repair_orders FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_for_shop_secure(shop_id));

-- Admins can update repair orders in their shop
CREATE POLICY "Admins can update repair orders in their shop"
  ON repair_orders FOR UPDATE
  TO authenticated
  USING (is_admin_for_shop_secure(shop_id))
  WITH CHECK (is_admin_for_shop_secure(shop_id));

-- Admins can delete repair orders in their shop
CREATE POLICY "Admins can delete repair orders in their shop"
  ON repair_orders FOR DELETE
  TO authenticated
  USING (is_admin_for_shop_secure(shop_id));

-- Customers can view their own repair orders
CREATE POLICY "Customers can view their own repair orders"
  ON repair_orders FOR SELECT
  TO authenticated
  USING (
    auth.uid() = (SELECT auth_user_id FROM customers WHERE id = customer_id)
  );

-- Create storage bucket for repair orders (executed via SQL as metadata)
INSERT INTO storage.buckets (id, name, public)
VALUES ('repair-orders', 'repair-orders', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for repair orders bucket
CREATE POLICY "Admins can upload repair orders"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'repair-orders' AND
    EXISTS (
      SELECT 1 FROM admins
      WHERE auth_user_id = auth.uid()
      AND is_active = true
    )
  );

CREATE POLICY "Admins can view repair orders in storage"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'repair-orders' AND
    EXISTS (
      SELECT 1 FROM admins
      WHERE auth_user_id = auth.uid()
      AND is_active = true
    )
  );

CREATE POLICY "Customers can view their repair orders in storage"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'repair-orders' AND
    EXISTS (
      SELECT 1 FROM repair_orders ro
      JOIN customers c ON c.id = ro.customer_id
      WHERE c.auth_user_id = auth.uid()
      AND ro.file_url LIKE '%' || name
    )
  );

CREATE POLICY "Admins can delete repair orders from storage"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'repair-orders' AND
    EXISTS (
      SELECT 1 FROM admins
      WHERE auth_user_id = auth.uid()
      AND is_active = true
    )
  );
