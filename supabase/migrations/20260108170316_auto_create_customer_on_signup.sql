/*
  # Auto-create Customer Record on User Signup

  1. Problem
    - When email confirmation is enabled, users are not authenticated immediately after signup
    - This means auth.uid() returns null when trying to insert customer record
    - RLS policies fail because there's no active session yet

  2. Solution
    - Create a database trigger that automatically creates customer record
    - Trigger runs on auth.users table when new user is created
    - Function runs with SECURITY DEFINER to bypass RLS
    - Uses user metadata to populate customer fields

  3. Changes
    - Create function to handle customer record creation
    - Create trigger on auth.users INSERT
    - Drop old INSERT policies that are no longer needed for manual insertion
    - Add new INSERT policy for admin-created customers only

  4. Security
    - Function runs with elevated privileges but is carefully scoped
    - Only creates customer record if one doesn't exist
    - Uses ON CONFLICT to handle race conditions
    - Admins can still manually create customer records
*/

-- Create function to automatically create customer record
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- Insert customer record with user's auth ID
  INSERT INTO public.customers (
    id,
    email,
    full_name,
    phone,
    has_account
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'phone',
    true
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Drop old INSERT policies
DROP POLICY IF EXISTS "Users can create own customer record" ON customers;
DROP POLICY IF EXISTS "Admins can create customer records" ON customers;

-- Create new INSERT policy for admins only (trigger handles regular signups)
CREATE POLICY "Admins can create customer records"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers
      WHERE id = auth.uid()
      AND is_admin = true
    )
  );
