/*
  # Add shop trial and onboarding system

  1. Changes to shops table
     - Add trial_ends_at: When the free trial expires
     - Add subscription_status: trial, active, cancelled, expired
     - Add subscription_tier: free, starter, professional, enterprise
     - Add onboarding_completed: Whether shop setup is done
     - Add billing_email: Email for billing notifications

  2. New table: shop_signup_requests
     - Tracks initial signup requests before shop creation
     - Stores shop name, owner details, and verification status

  3. Security
     - RLS enabled on shop_signup_requests
     - Allow public inserts for new signups
     - Only super_admins can view all requests
*/

-- Add trial and subscription fields to shops
ALTER TABLE shops ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'trial';
ALTER TABLE shops ADD COLUMN IF NOT EXISTS subscription_tier text DEFAULT 'starter';
ALTER TABLE shops ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS billing_email text;

-- Create shop_signup_requests table
CREATE TABLE IF NOT EXISTS shop_signup_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_name text NOT NULL,
  owner_name text NOT NULL,
  owner_email text NOT NULL,
  owner_phone text,
  business_address text,
  business_type text,
  number_of_bays int,
  status text NOT NULL DEFAULT 'pending',
  shop_id uuid REFERENCES shops(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_shop_signup_requests_email 
  ON shop_signup_requests(owner_email);

CREATE INDEX IF NOT EXISTS idx_shop_signup_requests_status 
  ON shop_signup_requests(status);

-- Enable RLS
ALTER TABLE shop_signup_requests ENABLE ROW LEVEL SECURITY;

-- Allow anyone to create a signup request (public signup)
DROP POLICY IF EXISTS "Anyone can create shop signup request" ON shop_signup_requests;
CREATE POLICY "Anyone can create shop signup request"
  ON shop_signup_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Super admins can view all signup requests
DROP POLICY IF EXISTS "Super admins can view all signup requests" ON shop_signup_requests;
CREATE POLICY "Super admins can view all signup requests"
  ON shop_signup_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.id = auth.uid()
    )
  );

-- Super admins can update signup requests
DROP POLICY IF EXISTS "Super admins can update signup requests" ON shop_signup_requests;
CREATE POLICY "Super admins can update signup requests"
  ON shop_signup_requests
  FOR UPDATE
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

-- Function to set trial expiration on new shops
CREATE OR REPLACE FUNCTION set_trial_expiration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.trial_ends_at IS NULL THEN
    NEW.trial_ends_at := now() + interval '30 days';
  END IF;
  
  IF NEW.subscription_status IS NULL THEN
    NEW.subscription_status := 'trial';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to auto-set trial expiration
DROP TRIGGER IF EXISTS set_trial_expiration_trigger ON shops;
CREATE TRIGGER set_trial_expiration_trigger
  BEFORE INSERT ON shops
  FOR EACH ROW
  EXECUTE FUNCTION set_trial_expiration();
