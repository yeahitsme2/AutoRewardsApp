/*
  # Fix Cancellation Type Constraint to Allow NULL

  ## Overview
  This migration fixes the check constraint on the cancellation_type column
  to allow NULL values. The constraint was too restrictive and prevented
  updates when the field wasn't set.

  ## Changes Made

  ### 1. Drop Existing Constraint
  - Remove the restrictive check constraint

  ### 2. Add New Constraint
  - Allow NULL values in addition to 'cancelled' and 'no-show'
  - This makes the field optional as intended

  ## Reason
  - The original constraint rejected NULL values
  - This caused errors when updating appointments without setting cancellation_type
  - NULL is valid for non-cancelled appointments or legacy data
*/

-- Drop the existing constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'appointments_cancellation_type_check'
  ) THEN
    ALTER TABLE appointments DROP CONSTRAINT appointments_cancellation_type_check;
  END IF;
END $$;

-- Add the corrected constraint that allows NULL
ALTER TABLE appointments 
  ADD CONSTRAINT appointments_cancellation_type_check 
  CHECK (cancellation_type IS NULL OR cancellation_type IN ('cancelled', 'no-show'));
