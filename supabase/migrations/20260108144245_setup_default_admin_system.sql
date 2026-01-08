/*
  # Setup Default Admin System

  ## Overview
  This migration implements an automatic admin assignment system and prepares for
  password management and admin user management features.

  ## Changes Made

  1. **Auto-Admin Assignment**
     - Creates a trigger that automatically makes the first registered user an admin
     - This solves the chicken-and-egg problem of creating the first admin
     - After the first admin exists, they can create additional admins through the UI

  2. **Account Management Fields**
     - Adds `is_deactivated` field to customers table to allow soft-deletion of accounts
     - Deactivated accounts cannot log in or access the system
     - Allows admins to deactivate problematic accounts without losing historical data

  ## Security Notes
  - Only the FIRST user to register becomes an admin automatically
  - All subsequent users are regular customers by default
  - Admins can promote other users to admin status through the Settings UI
  - Admins can deactivate accounts (including admin accounts)
  - At least one admin should always remain active to manage the system

  ## Usage
  1. Register the first user account - this becomes the default admin
  2. Log in as this admin to create additional admin accounts
  3. Use Settings to manage admin status and deactivate accounts as needed
*/

-- ============================================
-- ADD ACCOUNT MANAGEMENT FIELDS
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'is_deactivated'
  ) THEN
    ALTER TABLE customers ADD COLUMN is_deactivated boolean DEFAULT false;
  END IF;
END $$;

-- ============================================
-- AUTO-ADMIN TRIGGER FUNCTION
-- ============================================

-- Function to automatically make the first user an admin
CREATE OR REPLACE FUNCTION make_first_user_admin()
RETURNS TRIGGER AS $$
DECLARE
  admin_count integer;
BEGIN
  -- Count existing admins
  SELECT COUNT(*) INTO admin_count
  FROM customers
  WHERE is_admin = true;
  
  -- If no admins exist, make this user an admin
  IF admin_count = 0 THEN
    NEW.is_admin = true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate trigger to ensure it's up to date
DROP TRIGGER IF EXISTS trigger_make_first_user_admin ON customers;
CREATE TRIGGER trigger_make_first_user_admin
BEFORE INSERT ON customers
FOR EACH ROW
EXECUTE FUNCTION make_first_user_admin();

-- ============================================
-- UPDATE RLS POLICIES FOR DEACTIVATED ACCOUNTS
-- ============================================

-- Update the policy that allows users to read their own data to exclude deactivated accounts
DROP POLICY IF EXISTS "Users can read own customer data" ON customers;
CREATE POLICY "Users can read own customer data"
  ON customers FOR SELECT
  TO authenticated
  USING (id = auth.uid() AND is_deactivated = false);

-- Update the policy that allows users to update their own data to exclude deactivated accounts
DROP POLICY IF EXISTS "Users can update own customer data" ON customers;
CREATE POLICY "Users can update own customer data"
  ON customers FOR UPDATE
  TO authenticated
  USING (id = auth.uid() AND is_deactivated = false)
  WITH CHECK (id = auth.uid() AND is_deactivated = false);

-- ============================================
-- ADMIN MANAGEMENT POLICIES
-- ============================================

-- Allow admins to update other users' admin status and deactivation status
-- This is already covered by the existing "Admins can update all customer data" policy

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_customers_is_deactivated ON customers(is_deactivated);
CREATE INDEX IF NOT EXISTS idx_customers_is_admin ON customers(is_admin);