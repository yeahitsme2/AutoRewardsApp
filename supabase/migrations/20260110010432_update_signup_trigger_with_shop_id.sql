/*
  # Update Customer Creation Trigger for Multi-Tenant Support

  ## Overview
  This migration updates the handle_new_user trigger function to include
  shop_id from user metadata when creating customer records.

  ## Changes

  ### handle_new_user function
  - Now reads shop_id from raw_user_meta_data
  - Defaults to 'default' shop if no shop_id provided
  - Associates new customers with the correct shop

  ## Important Notes
  - Frontend must pass shop_id in user metadata during signup
  - Existing users without shop_id will be assigned to default shop
*/

-- Update the function to include shop_id
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  shop_id_value uuid;
BEGIN
  -- Get shop_id from metadata or default
  shop_id_value := (NEW.raw_user_meta_data->>'shop_id')::uuid;
  
  -- If no shop_id provided, use default shop
  IF shop_id_value IS NULL THEN
    SELECT id INTO shop_id_value FROM shops WHERE slug = 'default' LIMIT 1;
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
