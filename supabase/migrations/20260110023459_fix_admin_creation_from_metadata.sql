/*
  # Fix Admin Creation from User Metadata

  ## Problem
  When super admins create new admin accounts, the trigger doesn't respect the is_admin flag.
  The trigger creates a customer with is_admin = false, then super admin tries to update it.

  ## Solution
  Update the handle_new_user() trigger to check for is_admin in the metadata and set it during creation.

  ## Changes
  - Modify handle_new_user() to read is_admin from raw_user_meta_data
  - If is_admin is set in metadata, create the customer as an admin
  - This allows super admins to create admin accounts directly
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
  v_is_admin boolean;
BEGIN
  v_shop_id := (NEW.raw_user_meta_data->>'shop_id')::uuid;
  v_full_name := NEW.raw_user_meta_data->>'full_name';
  v_email := NEW.email;
  v_phone := NEW.raw_user_meta_data->>'phone';
  v_is_admin := COALESCE((NEW.raw_user_meta_data->>'is_admin')::boolean, false);

  IF v_shop_id IS NOT NULL THEN
    INSERT INTO customers (auth_user_id, shop_id, email, full_name, phone, is_admin)
    VALUES (NEW.id, v_shop_id, v_email, COALESCE(v_full_name, 'Customer'), v_phone, v_is_admin)
    ON CONFLICT (auth_user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
