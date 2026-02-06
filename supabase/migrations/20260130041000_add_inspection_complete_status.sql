/*
  # Add inspection_complete status for repair orders

  - Adds inspection_complete to the repair_orders.status enum when applicable.
*/

DO $$
DECLARE
  status_type text;
  status_kind text;
BEGIN
  SELECT t.typname, t.typtype
  INTO status_type, status_kind
  FROM pg_attribute a
  JOIN pg_class c ON a.attrelid = c.oid
  JOIN pg_namespace n ON c.relnamespace = n.oid
  JOIN pg_type t ON a.atttypid = t.oid
  WHERE n.nspname = 'public'
    AND c.relname = 'repair_orders'
    AND a.attname = 'status';

  IF status_kind = 'e' THEN
    EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', status_type, 'inspection_complete');
  END IF;
END $$;
