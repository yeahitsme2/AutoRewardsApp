/*
  # Fix appointments.confirmed_by Foreign Key Reference

  ## Overview
  The `confirmed_by` column in the appointments table was incorrectly referencing
  the customers table. Since only admins can confirm appointments, it should
  reference the admins table instead.

  ## Changes Made

  ### 1. Drop Incorrect Foreign Key
  - Remove the foreign key constraint pointing to customers(id)

  ### 2. Create Correct Foreign Key
  - Add foreign key constraint pointing to admins(id)
  - This allows admins to properly confirm appointments

  ## Security
  - No RLS changes needed
  - Existing policies already handle admin access
*/

-- Drop the incorrect foreign key constraint to customers
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  INNER JOIN pg_class rel ON rel.oid = con.conrelid
  INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'appointments'
    AND con.contype = 'f'
    AND EXISTS (
      SELECT 1 FROM pg_attribute
      WHERE attrelid = con.conrelid
        AND attnum = ANY(con.conkey)
        AND attname = 'confirmed_by'
    );

  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE appointments DROP CONSTRAINT ' || quote_ident(constraint_name);
  END IF;
END $$;

-- Add the correct foreign key constraint to admins
ALTER TABLE appointments 
  ADD CONSTRAINT appointments_confirmed_by_fkey 
  FOREIGN KEY (confirmed_by) 
  REFERENCES admins(id) 
  ON DELETE SET NULL;
