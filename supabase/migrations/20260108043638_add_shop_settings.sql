/*
  # Add Shop Settings Table

  1. New Tables
    - `shop_settings`
      - `id` (uuid, primary key)
      - `points_per_dollar` (numeric, default 10) - How many points earned per dollar spent
      - `updated_at` (timestamptz) - Last time settings were updated
      - `updated_by` (uuid) - Admin who last updated the settings
  
  2. Security
    - Enable RLS on `shop_settings` table
    - Add policy for admins to read settings
    - Add policy for admins to update settings
  
  3. Initial Data
    - Insert default settings with 10 points per dollar
*/

-- Create shop_settings table
CREATE TABLE IF NOT EXISTS shop_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  points_per_dollar numeric NOT NULL DEFAULT 10,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES customers(id)
);

-- Enable RLS
ALTER TABLE shop_settings ENABLE ROW LEVEL SECURITY;

-- Admins can read settings
CREATE POLICY "Admins can read shop settings"
  ON shop_settings
  FOR SELECT
  TO authenticated
  USING (is_admin());

-- Admins can update settings
CREATE POLICY "Admins can update shop settings"
  ON shop_settings
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Insert default settings (only if table is empty)
INSERT INTO shop_settings (points_per_dollar)
SELECT 10
WHERE NOT EXISTS (SELECT 1 FROM shop_settings);
