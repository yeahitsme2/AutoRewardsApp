/*
  # Update customer creation trigger to include phone

  1. Changes
    - Update handle_new_user function to also capture phone from metadata
*/

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_shop_id uuid;
  v_full_name text;
  v_email text;
  v_phone text;
BEGIN
  v_shop_id := (NEW.raw_user_meta_data->>'shop_id')::uuid;
  v_full_name := NEW.raw_user_meta_data->>'full_name';
  v_email := NEW.email;
  v_phone := NEW.raw_user_meta_data->>'phone';

  IF v_shop_id IS NOT NULL THEN
    INSERT INTO customers (auth_user_id, shop_id, email, full_name, phone)
    VALUES (NEW.id, v_shop_id, v_email, COALESCE(v_full_name, 'Customer'), v_phone)
    ON CONFLICT (auth_user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
