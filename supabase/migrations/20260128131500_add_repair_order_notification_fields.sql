/*
  # Add repair order response and notification tracking
*/

ALTER TABLE repair_orders
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES admins(id),
  ADD COLUMN IF NOT EXISTS customer_response_by uuid REFERENCES customers(id),
  ADD COLUMN IF NOT EXISTS customer_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS customer_declined_at timestamptz,
  ADD COLUMN IF NOT EXISTS customer_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_notified_at timestamptz;
