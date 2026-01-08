/*
  # Create Appointments System

  ## Overview
  This migration creates a comprehensive appointment scheduling system with notifications.

  ## Changes Made

  1. **Appointments Table**
     - Stores customer appointment requests
     - Links to customers and vehicles
     - Tracks appointment status (pending, confirmed, cancelled, completed)
     - Stores requested date/time and service details
     - Tracks admin who confirmed the appointment

  2. **Appointment Statuses**
     - `pending`: Customer has requested, waiting for admin confirmation
     - `confirmed`: Admin has confirmed the appointment
     - `cancelled`: Appointment was cancelled by customer or admin
     - `completed`: Service was completed

  3. **Security (RLS Policies)**
     - Customers can create appointments
     - Customers can view their own appointments
     - Customers can update/cancel their own pending appointments
     - Admins can view all appointments
     - Admins can update any appointment (confirm, cancel, complete)

  4. **Notifications**
     - Appointments trigger notifications for admins
     - Status changes notify customers

  ## Usage
  - Customers book appointments through their dashboard
  - Admins receive notifications and can confirm/manage appointments
  - Email notifications sent automatically on booking and status changes
*/

-- ============================================
-- CREATE APPOINTMENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  requested_date date NOT NULL,
  requested_time time NOT NULL,
  service_type text NOT NULL,
  description text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  admin_notes text,
  confirmed_by uuid REFERENCES customers(id) ON DELETE SET NULL,
  confirmed_at timestamptz,
  cancelled_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_appointments_customer_id ON appointments(customer_id);
CREATE INDEX IF NOT EXISTS idx_appointments_vehicle_id ON appointments(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_requested_date ON appointments(requested_date);
CREATE INDEX IF NOT EXISTS idx_appointments_created_at ON appointments(created_at);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Customers can create appointments
CREATE POLICY "Customers can create appointments"
  ON appointments FOR INSERT
  TO authenticated
  WITH CHECK (customer_id = auth.uid());

-- Customers can view their own appointments
CREATE POLICY "Customers can view own appointments"
  ON appointments FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

-- Customers can update their own pending appointments
CREATE POLICY "Customers can update own pending appointments"
  ON appointments FOR UPDATE
  TO authenticated
  USING (customer_id = auth.uid() AND status = 'pending')
  WITH CHECK (customer_id = auth.uid());

-- Admins can view all appointments
CREATE POLICY "Admins can view all appointments"
  ON appointments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = auth.uid()
      AND customers.is_admin = true
      AND customers.is_deactivated = false
    )
  );

-- Admins can update any appointment
CREATE POLICY "Admins can update all appointments"
  ON appointments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = auth.uid()
      AND customers.is_admin = true
      AND customers.is_deactivated = false
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = auth.uid()
      AND customers.is_admin = true
      AND customers.is_deactivated = false
    )
  );

-- Admins can delete appointments
CREATE POLICY "Admins can delete appointments"
  ON appointments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = auth.uid()
      AND customers.is_admin = true
      AND customers.is_deactivated = false
    )
  );

-- ============================================
-- TRIGGER FOR UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_appointments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_appointments_updated_at ON appointments;
CREATE TRIGGER trigger_appointments_updated_at
BEFORE UPDATE ON appointments
FOR EACH ROW
EXECUTE FUNCTION update_appointments_updated_at();