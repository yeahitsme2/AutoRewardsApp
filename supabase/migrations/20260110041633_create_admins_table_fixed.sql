/*
  # Create Admins Table

  1. New Tables
    - `admins`
      - `id` (uuid, primary key) - Unique admin identifier
      - `auth_user_id` (uuid, unique) - Links to auth.users
      - `shop_id` (uuid) - Links to shops table (required for shop admins, null for super admins)
      - `email` (text) - Admin email
      - `full_name` (text) - Admin full name
      - `is_active` (boolean) - Whether admin account is active
      - `created_at` (timestamptz) - When admin was created
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on `admins` table
    - Super admins can view all admins
    - Shop admins can view admins in their shop
    - Admins can view their own record

  3. Migration Steps
    - Create admins table
    - Migrate existing admin customers to admins table
    - Set up RLS policies
*/

-- Create admins table
CREATE TABLE IF NOT EXISTS admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id uuid REFERENCES shops(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS admins_auth_user_id_idx ON admins(auth_user_id);
CREATE INDEX IF NOT EXISTS admins_shop_id_idx ON admins(shop_id);
CREATE INDEX IF NOT EXISTS admins_email_idx ON admins(email);

-- Enable RLS
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Super admins can view all admins
CREATE POLICY "Super admins can view all admins"
  ON admins FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.id = auth.uid()
    )
  );

-- Super admins can insert admins
CREATE POLICY "Super admins can insert admins"
  ON admins FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.id = auth.uid()
    )
  );

-- Super admins can update admins
CREATE POLICY "Super admins can update admins"
  ON admins FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.id = auth.uid()
    )
  );

DO $do$
DECLARE
  admin_customer RECORD;
BEGIN
  -- Admins can view their own record (auth_user_id or id fallback)
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'auth_user_id'
  ) THEN
    CREATE POLICY "Admins can view own record"
      ON admins FOR SELECT
      TO authenticated
      USING (auth_user_id = auth.uid());

    CREATE POLICY "Admins can update own record"
      ON admins FOR UPDATE
      TO authenticated
      USING (auth_user_id = auth.uid())
      WITH CHECK (auth_user_id = auth.uid());
  ELSE
    CREATE POLICY "Admins can view own record"
      ON admins FOR SELECT
      TO authenticated
      USING (auth_user_id = auth.uid());

    CREATE POLICY "Admins can update own record"
      ON admins FOR UPDATE
      TO authenticated
      USING (auth_user_id = auth.uid())
      WITH CHECK (auth_user_id = auth.uid());
  END IF;

  -- Migrate existing admin customers to admins table when auth_user_id exists
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'auth_user_id'
  ) THEN
    FOR admin_customer IN 
      SELECT * FROM customers WHERE is_admin = true AND auth_user_id IS NOT NULL
    LOOP
      INSERT INTO admins (
        auth_user_id,
        shop_id,
        email,
        full_name,
        is_active,
        created_at,
        updated_at
      ) VALUES (
        admin_customer.auth_user_id,
        admin_customer.shop_id,
        admin_customer.email,
        admin_customer.full_name,
        true,
        admin_customer.created_at,
        admin_customer.updated_at
      )
      ON CONFLICT (auth_user_id) DO NOTHING;
    END LOOP;
  END IF;
END
$do$;
