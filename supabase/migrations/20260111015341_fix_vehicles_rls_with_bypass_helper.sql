/*
  # Fix vehicles RLS to avoid recursion via admins table
  
  1. Changes
    - Creates a helper function that checks if user is an admin for a shop (bypasses RLS)
    - Updates vehicles policies to use the helper function instead of direct EXISTS queries
    - This prevents recursion when checking admin permissions
  
  2. Security
    - Admins can manage vehicles in their shop
    - Customers can view/update their own vehicles
    - All checks are secure and bypass RLS properly
*/

DO $do$
BEGIN
  -- Drop existing admin policies for vehicles
  DROP POLICY IF EXISTS "Shop admins can view vehicles" ON vehicles;
  DROP POLICY IF EXISTS "Shop admins can insert vehicles" ON vehicles;
  DROP POLICY IF EXISTS "Shop admins can update vehicles" ON vehicles;
  DROP POLICY IF EXISTS "Shop admins can delete vehicles" ON vehicles;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'shop_id'
  ) THEN
    -- Create a helper function that bypasses RLS to check if user is admin for a shop
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

    -- Recreate policies using the bypass helper function
    CREATE POLICY "Shop admins can view vehicles"
      ON vehicles
      FOR SELECT
      TO authenticated
      USING (is_admin_for_shop(shop_id));

    CREATE POLICY "Shop admins can insert vehicles"
      ON vehicles
      FOR INSERT
      TO authenticated
      WITH CHECK (is_admin_for_shop(shop_id));

    CREATE POLICY "Shop admins can update vehicles"
      ON vehicles
      FOR UPDATE
      TO authenticated
      USING (is_admin_for_shop(shop_id))
      WITH CHECK (is_admin_for_shop(shop_id));

    CREATE POLICY "Shop admins can delete vehicles"
      ON vehicles
      FOR DELETE
      TO authenticated
      USING (is_admin_for_shop(shop_id));
  ELSE
    CREATE OR REPLACE FUNCTION is_admin_for_vehicle(check_customer_id uuid)
    RETURNS boolean
    LANGUAGE sql
    STABLE SECURITY DEFINER
    SET search_path = public
    AS $$
      SELECT EXISTS (
        SELECT 1
        FROM admins
        JOIN customers ON customers.id = check_customer_id
        WHERE admins.auth_user_id = auth.uid()
        AND admins.shop_id = customers.shop_id
        AND admins.is_active = true
      );
    $$;

    CREATE POLICY "Shop admins can view vehicles"
      ON vehicles
      FOR SELECT
      TO authenticated
      USING (is_admin_for_vehicle(customer_id));

    CREATE POLICY "Shop admins can insert vehicles"
      ON vehicles
      FOR INSERT
      TO authenticated
      WITH CHECK (is_admin_for_vehicle(customer_id));

    CREATE POLICY "Shop admins can update vehicles"
      ON vehicles
      FOR UPDATE
      TO authenticated
      USING (is_admin_for_vehicle(customer_id))
      WITH CHECK (is_admin_for_vehicle(customer_id));

    CREATE POLICY "Shop admins can delete vehicles"
      ON vehicles
      FOR DELETE
      TO authenticated
      USING (is_admin_for_vehicle(customer_id));
  END IF;
END
$do$;
