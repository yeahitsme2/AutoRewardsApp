/*
  # Fix vehicles RLS policies with direct admin check
  
  1. Changes
    - Replaces is_admin_for_shop() calls with direct subquery
    - This avoids any potential recursion or SECURITY DEFINER issues
    - Checks admins table directly in the policy
  
  2. Security
    - Maintains same security model
    - Shop admins can only manage vehicles in their shop
    - Customers can still manage their own vehicles
*/

-- Drop existing admin policies that use helper function
DROP POLICY IF EXISTS "Shop admins can view vehicles" ON vehicles;
DROP POLICY IF EXISTS "Shop admins can insert vehicles" ON vehicles;
DROP POLICY IF EXISTS "Shop admins can update vehicles" ON vehicles;
DROP POLICY IF EXISTS "Shop admins can delete vehicles" ON vehicles;

DO $do$
BEGIN
  -- Recreate policies with direct checks
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicles' AND column_name = 'shop_id'
  ) THEN
    CREATE POLICY "Shop admins can view vehicles"
      ON vehicles FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM admins
          WHERE admins.auth_user_id = auth.uid()
          AND admins.shop_id = vehicles.shop_id
          AND admins.is_active = true
        )
      );

    CREATE POLICY "Shop admins can insert vehicles"
      ON vehicles FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM admins
          WHERE admins.auth_user_id = auth.uid()
          AND admins.shop_id = vehicles.shop_id
          AND admins.is_active = true
        )
      );

    CREATE POLICY "Shop admins can update vehicles"
      ON vehicles FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM admins
          WHERE admins.auth_user_id = auth.uid()
          AND admins.shop_id = vehicles.shop_id
          AND admins.is_active = true
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM admins
          WHERE admins.auth_user_id = auth.uid()
          AND admins.shop_id = vehicles.shop_id
          AND admins.is_active = true
        )
      );

    CREATE POLICY "Shop admins can delete vehicles"
      ON vehicles FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM admins
          WHERE admins.auth_user_id = auth.uid()
          AND admins.shop_id = vehicles.shop_id
          AND admins.is_active = true
        )
      );
  ELSE
    CREATE POLICY "Shop admins can view vehicles"
      ON vehicles FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM admins
          JOIN customers ON customers.id = vehicles.customer_id
          WHERE admins.auth_user_id = auth.uid()
          AND admins.shop_id = customers.shop_id
          AND admins.is_active = true
        )
      );

    CREATE POLICY "Shop admins can insert vehicles"
      ON vehicles FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM admins
          JOIN customers ON customers.id = vehicles.customer_id
          WHERE admins.auth_user_id = auth.uid()
          AND admins.shop_id = customers.shop_id
          AND admins.is_active = true
        )
      );

    CREATE POLICY "Shop admins can update vehicles"
      ON vehicles FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM admins
          JOIN customers ON customers.id = vehicles.customer_id
          WHERE admins.auth_user_id = auth.uid()
          AND admins.shop_id = customers.shop_id
          AND admins.is_active = true
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM admins
          JOIN customers ON customers.id = vehicles.customer_id
          WHERE admins.auth_user_id = auth.uid()
          AND admins.shop_id = customers.shop_id
          AND admins.is_active = true
        )
      );

    CREATE POLICY "Shop admins can delete vehicles"
      ON vehicles FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM admins
          JOIN customers ON customers.id = vehicles.customer_id
          WHERE admins.auth_user_id = auth.uid()
          AND admins.shop_id = customers.shop_id
          AND admins.is_active = true
        )
      );
  END IF;
END
$do$;
