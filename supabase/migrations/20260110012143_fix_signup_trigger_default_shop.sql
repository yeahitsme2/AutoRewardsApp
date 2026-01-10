/*
  # Fix Signup Trigger Default Shop

  1. Problem
    - Trigger looks for shop with slug 'default' which doesn't exist
    - New users get NULL shop_id

  2. Solution
    - Update trigger to use first active shop as fallback
*/

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  shop_id_value uuid;
BEGIN
  -- Get shop_id from metadata
  shop_id_value := (NEW.raw_user_meta_data->>'shop_id')::uuid;

  -- If no shop_id provided, use first active shop
  IF shop_id_value IS NULL THEN
    SELECT id INTO shop_id_value FROM shops WHERE is_active = true LIMIT 1;
  END IF;

  -- Insert customer record with user's auth ID and shop
  INSERT INTO public.customers (
    id,
    email,
    full_name,
    phone,
    has_account,
    shop_id
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'phone',
    true,
    shop_id_value
  )
  ON CONFLICT (id) DO UPDATE SET
    shop_id = COALESCE(EXCLUDED.shop_id, customers.shop_id);

  RETURN NEW;
END;
$$;
