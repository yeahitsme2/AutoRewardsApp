/*
  # Add Cancellation Type to Appointments

  ## Overview
  This migration adds a cancellation_type column to track whether an appointment
  was cancelled by request or marked as a no-show.

  ## Changes Made

  ### 1. Add cancellation_type Column
  - Type: text (enum-like with 'cancelled' or 'no-show')
  - Nullable: Yes (only set when appointment is cancelled)
  - Purpose: Distinguish between regular cancellations and no-shows

  ## Usage
  - When status is 'cancelled' and cancellation_type is 'cancelled': Regular cancellation
  - When status is 'cancelled' and cancellation_type is 'no-show': Customer didn't show up
  - When status is 'cancelled' and cancellation_type is NULL: Legacy cancellation (before this feature)

  ## Security
  - No RLS changes needed
  - Existing policies already control appointment updates
*/

-- Add cancellation_type column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'cancellation_type'
  ) THEN
    ALTER TABLE appointments ADD COLUMN cancellation_type text;
  END IF;
END $$;

-- Add a check constraint to ensure valid cancellation types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'appointments_cancellation_type_check'
  ) THEN
    ALTER TABLE appointments 
      ADD CONSTRAINT appointments_cancellation_type_check 
      CHECK (cancellation_type IN ('cancelled', 'no-show'));
  END IF;
END $$;
