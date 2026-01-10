/*
  # Add Vehicle Mileage and Service Tracking Columns

  1. Changes
    - Add `current_mileage` column to vehicles table for tracking current mileage
    - Add `last_service_date` for tracking last service date
    - Add `last_service_mileage` for tracking mileage at last service
    - Add `next_service_due_date` for time-based reminders
    - Add `next_service_due_mileage` for mileage-based reminders

  2. Notes
    - All columns are optional to maintain backward compatibility
    - current_mileage defaults to 0
*/

-- Add mileage and service tracking columns to vehicles
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vehicles' AND column_name = 'current_mileage'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN current_mileage integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vehicles' AND column_name = 'last_service_date'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN last_service_date timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vehicles' AND column_name = 'last_service_mileage'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN last_service_mileage integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vehicles' AND column_name = 'next_service_due_date'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN next_service_due_date timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vehicles' AND column_name = 'next_service_due_mileage'
  ) THEN
    ALTER TABLE vehicles ADD COLUMN next_service_due_mileage integer;
  END IF;
END $$;
