/*
  # Add Shop Groups for Multi-Location Support

  1. New Tables
    - `shop_groups`
      - `id` (uuid, primary key)
      - `name` (text) - Name of the shop group/chain
      - `created_at` (timestamp)

  2. Changes
    - Add `shop_group_id` to `shops` table
    - This allows multiple shops to be linked together
    - When shops are in the same group, they share:
      - Customer information
      - Rewards and points
      - Vehicles
      - Service history

  3. Security
    - Enable RLS on `shop_groups` table
    - Super admins can manage shop groups
    - Shop admins can view their shop's group
    - Update existing RLS policies to respect shop groups
*/

-- Create shop_groups table
CREATE TABLE IF NOT EXISTS shop_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE shop_groups ENABLE ROW LEVEL SECURITY;

-- Add shop_group_id to shops table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shops' AND column_name = 'shop_group_id'
  ) THEN
    ALTER TABLE shops ADD COLUMN shop_group_id uuid REFERENCES shop_groups(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_shops_shop_group_id ON shops(shop_group_id);
  END IF;
END $$;

-- Super admins can manage shop groups
CREATE POLICY "Super admins can view all shop groups"
  ON shop_groups FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.id = auth.uid()
    )
  );

CREATE POLICY "Super admins can create shop groups"
  ON shop_groups FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.id = auth.uid()
    )
  );

CREATE POLICY "Super admins can update shop groups"
  ON shop_groups FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.id = auth.uid()
    )
  );

CREATE POLICY "Super admins can delete shop groups"
  ON shop_groups FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.id = auth.uid()
    )
  );

-- Shop admins can view their shop's group
CREATE POLICY "Shop admins can view their shop group"
  ON shop_groups FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      JOIN shops ON shops.id = admins.shop_id
      WHERE admins.auth_user_id = auth.uid()
      AND shops.shop_group_id = shop_groups.id
    )
  );

-- Create helper function to check if two shops are in the same group
CREATE OR REPLACE FUNCTION shops_are_linked(shop_id_1 uuid, shop_id_2 uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    CASE 
      WHEN shop_id_1 = shop_id_2 THEN true
      ELSE EXISTS (
        SELECT 1 
        FROM shops s1
        JOIN shops s2 ON s1.shop_group_id = s2.shop_group_id
        WHERE s1.id = shop_id_1 
        AND s2.id = shop_id_2
        AND s1.shop_group_id IS NOT NULL
      )
    END;
$$;

-- Create helper function to get all linked shop IDs for a given shop
CREATE OR REPLACE FUNCTION get_linked_shop_ids(input_shop_id uuid)
RETURNS TABLE(shop_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT s.id
  FROM shops s
  WHERE s.id = input_shop_id
  OR (
    s.shop_group_id IS NOT NULL
    AND s.shop_group_id = (
      SELECT shop_group_id 
      FROM shops 
      WHERE id = input_shop_id
    )
  );
$$;
