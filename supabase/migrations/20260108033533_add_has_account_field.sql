/*
  # Add has_account field to customers

  ## Changes
  - Add a boolean field to track whether a customer has an auth account
  - Defaults to false (walk-in customers)
  - Set to true for existing customers with auth accounts

  ## Notes
  - Walk-in customers: has_account = false
  - Customers who sign up or are created with auth: has_account = true
*/

-- Add the has_account field
ALTER TABLE customers 
  ADD COLUMN IF NOT EXISTS has_account boolean DEFAULT false;

-- Update existing customers to set has_account = true
-- (assuming existing customers have auth accounts based on their id matching auth.uid pattern)
UPDATE customers 
SET has_account = true 
WHERE is_admin = true OR email LIKE '%@%';