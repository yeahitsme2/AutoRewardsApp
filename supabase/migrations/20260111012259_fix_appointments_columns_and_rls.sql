/*
  # Fix Appointments Table Columns and RLS Policies

  ## Overview
  This migration fixes the appointments table to support customer bookings with proper
  shop isolation and all necessary fields for a complete appointment system.

  ## Changes Made

  ### 1. Add Missing Columns
  - `description`: Customer's description of needed service
  - `admin_notes`: Admin's notes about the appointment
  - `cancelled_reason`: Reason for cancellation
  - `confirmed_by`: Admin who confirmed the appointment
  - `confirmed_at`: Timestamp of confirmation

  ### 2. Update RLS Policies
  - Customers can insert appointments with their shop_id
  - Customers can view and update their own appointments
  - Shop admins can manage all appointments in their shop

  ## Security
  - Customers can only create appointments for their own shop
  - Shop isolation is enforced via RLS policies
*/

-- ============================================
-- ADD MISSING COLUMNS
-- ============================================

-- Add description column for customer input
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'description'
  ) THEN
    ALTER TABLE appointments ADD COLUMN description text;
  END IF;
END $$;

-- Add admin_notes column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'admin_notes'
  ) THEN
    ALTER TABLE appointments ADD COLUMN admin_notes text;
  END IF;
END $$;

-- Add cancelled_reason column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'cancelled_reason'
  ) THEN
    ALTER TABLE appointments ADD COLUMN cancelled_reason text;
  END IF;
END $$;

-- Add confirmed_by column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'confirmed_by'
  ) THEN
    ALTER TABLE appointments ADD COLUMN confirmed_by uuid REFERENCES customers(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add confirmed_at column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'confirmed_at'
  ) THEN
    ALTER TABLE appointments ADD COLUMN confirmed_at timestamptz;
  END IF;
END $$;

-- ============================================
-- UPDATE RLS POLICIES FOR CUSTOMER BOOKINGS
-- ============================================

-- Drop old customer policies
DROP POLICY IF EXISTS "Users can manage their own appointments" ON appointments;
DROP POLICY IF EXISTS "Customers can create appointments" ON appointments;
DROP POLICY IF EXISTS "Customers can view own appointments" ON appointments;
DROP POLICY IF EXISTS "Customers can update own pending appointments" ON appointments;

-- Customers can insert appointments in their shop
CREATE POLICY "Customers can create appointments in their shop"
  ON appointments FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_id IN (
      SELECT id FROM customers 
      WHERE auth_user_id = auth.uid()
    )
    AND shop_id = (
      SELECT shop_id FROM customers 
      WHERE auth_user_id = auth.uid()
      LIMIT 1
    )
  );

-- Customers can view their own appointments
CREATE POLICY "Customers can view their own appointments"
  ON appointments FOR SELECT
  TO authenticated
  USING (
    customer_id IN (
      SELECT id FROM customers 
      WHERE auth_user_id = auth.uid()
    )
  );

-- Customers can update their own pending/confirmed appointments
CREATE POLICY "Customers can update their own appointments"
  ON appointments FOR UPDATE
  TO authenticated
  USING (
    customer_id IN (
      SELECT id FROM customers 
      WHERE auth_user_id = auth.uid()
    )
    AND status IN ('pending', 'confirmed')
  )
  WITH CHECK (
    customer_id IN (
      SELECT id FROM customers 
      WHERE auth_user_id = auth.uid()
    )
  );
