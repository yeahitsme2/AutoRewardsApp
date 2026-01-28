/*
  # Fix services RLS to avoid recursion via admins table
  
  1. Changes
    - Updates services policies to use the is_admin_for_shop helper function
    - This prevents recursion when checking admin permissions
  
  2. Security
    - Admins can manage services in their shop
    - Customers can view their own services
    - All checks are secure and bypass RLS properly
*/

-- Drop existing admin policy for services
DROP POLICY IF EXISTS "Shop admins can manage their shop services" ON services;

-- Ensure helper exists (safe to recreate)
CREATE OR REPLACE FUNCTION is_admin_for_shop(check_shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM admins
    WHERE auth_user_id = auth.uid()
    AND shop_id = check_shop_id
    AND is_active = true
  );
$$;

DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'shop_id'
  ) THEN
    -- Recreate policy using the bypass helper function
    CREATE POLICY "Shop admins can manage their shop services"
      ON services
      FOR ALL
      TO authenticated
      USING (is_admin_for_shop(shop_id))
      WITH CHECK (is_admin_for_shop(shop_id));
  ELSE
    CREATE POLICY "Shop admins can manage their shop services"
      ON services
      FOR ALL
      TO authenticated
      USING (is_admin_for_shop((SELECT shop_id FROM customers WHERE id = services.customer_id)))
      WITH CHECK (is_admin_for_shop((SELECT shop_id FROM customers WHERE id = services.customer_id)));
  END IF;
END
$do$;
