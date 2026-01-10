/*
  # Add Multi-Tenant Shop Support

  ## Overview
  This migration adds multi-tenant support allowing this system to be sold to 
  multiple automotive repair shops, each with their own branding, customers, and data.

  ## New Tables

  ### `shops`
  - `id` (uuid, primary key) - Unique shop identifier
  - `name` (text) - Shop business name
  - `slug` (text, unique) - URL-friendly identifier for the shop
  - `is_active` (boolean) - Whether the shop is active
  - `created_at` (timestamptz) - When the shop was created

  ## Modified Tables

  ### `customers`
  - Added `shop_id` (uuid) - Links customer to their shop

  ### `shop_settings`
  - Added `shop_id` (uuid) - Links settings to specific shop

  ## Security
  - RLS policies updated to enforce shop-based data isolation
  - Users can only access data from their own shop
  - Public can read shop info by slug for branding

  ## Important Notes
  - Existing data will be associated with a default shop
  - The slug is used for URL-based shop identification
  - Branding settings are now shop-specific
*/

-- Create shops table
CREATE TABLE IF NOT EXISTS shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on shops
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;

-- Anyone can read active shops (needed for branding lookup by slug)
CREATE POLICY "Anyone can read active shops"
  ON shops
  FOR SELECT
  USING (is_active = true);

-- Add shop_id to customers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'shop_id'
  ) THEN
    ALTER TABLE customers ADD COLUMN shop_id uuid REFERENCES shops(id);
  END IF;
END $$;

-- Add shop_id to shop_settings table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_settings' AND column_name = 'shop_id'
  ) THEN
    ALTER TABLE shop_settings ADD COLUMN shop_id uuid REFERENCES shops(id);
  END IF;
END $$;

-- Create a default shop for existing data
INSERT INTO shops (id, name, slug)
SELECT 
  gen_random_uuid(),
  'Default Auto Shop',
  'default'
WHERE NOT EXISTS (SELECT 1 FROM shops WHERE slug = 'default');

-- Get the default shop id and update existing records
DO $$
DECLARE
  default_shop_id uuid;
BEGIN
  SELECT id INTO default_shop_id FROM shops WHERE slug = 'default' LIMIT 1;
  
  -- Update existing customers without a shop
  UPDATE customers SET shop_id = default_shop_id WHERE shop_id IS NULL;
  
  -- Update existing shop_settings without a shop
  UPDATE shop_settings SET shop_id = default_shop_id WHERE shop_id IS NULL;
END $$;

-- Create index for shop lookups
CREATE INDEX IF NOT EXISTS idx_shops_slug ON shops(slug);
CREATE INDEX IF NOT EXISTS idx_customers_shop_id ON customers(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_settings_shop_id ON shop_settings(shop_id);

-- Create function to get user's shop_id
CREATE OR REPLACE FUNCTION get_user_shop_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT shop_id FROM customers WHERE id = auth.uid() LIMIT 1;
$$;

-- Create function to check if user is admin of a specific shop
CREATE OR REPLACE FUNCTION is_shop_admin(check_shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM customers
    WHERE id = auth.uid()
    AND is_admin = true
    AND shop_id = check_shop_id
  );
$$;

-- Allow public to read shop_settings for any active shop (for branding)
DROP POLICY IF EXISTS "Anyone can read shop settings for branding" ON shop_settings;
CREATE POLICY "Anyone can read shop settings for branding"
  ON shop_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM shops 
      WHERE shops.id = shop_settings.shop_id 
      AND shops.is_active = true
    )
  );

-- Update admin policies to be shop-scoped
DROP POLICY IF EXISTS "Admins can update shop settings" ON shop_settings;
CREATE POLICY "Admins can update shop settings"
  ON shop_settings
  FOR UPDATE
  TO authenticated
  USING (is_shop_admin(shop_id))
  WITH CHECK (is_shop_admin(shop_id));

-- Add unique constraint on shop_id for shop_settings (one settings row per shop)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'shop_settings_shop_id_unique'
  ) THEN
    ALTER TABLE shop_settings ADD CONSTRAINT shop_settings_shop_id_unique UNIQUE (shop_id);
  END IF;
END $$;
