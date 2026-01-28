/*
  # Fix appointments RLS to avoid recursion
  
  1. Changes
    - Drops the old appointments policy that queries admins table directly
    - Creates new policy using is_admin_for_shop helper function
    - This prevents recursion when checking admin permissions
  
  2. Security
    - Admins can manage appointments in their shop
    - Customers can manage their own appointments
*/

-- Drop the old recursive policy
DROP POLICY IF EXISTS "Shop admins can manage their shop appointments" ON appointments;

DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'shop_id'
  ) THEN
    -- Create new policy using the bypass helper function
    CREATE POLICY "Shop admins can manage their shop appointments"
      ON appointments
      FOR ALL
      TO authenticated
      USING (is_admin_for_shop(shop_id))
      WITH CHECK (is_admin_for_shop(shop_id));
  ELSE
    CREATE POLICY "Shop admins can manage their shop appointments"
      ON appointments
      FOR ALL
      TO authenticated
      USING (is_admin_for_shop((SELECT shop_id FROM customers WHERE id = appointments.customer_id)))
      WITH CHECK (is_admin_for_shop((SELECT shop_id FROM customers WHERE id = appointments.customer_id)));
  END IF;
END
$do$;
