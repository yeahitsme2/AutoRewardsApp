/*
  # Allow admins to view other admins in their shop
  
  1. Changes
    - Add SELECT policy for admins to view other admins in the same shop
  
  2. Security
    - Admins can only view admins from their own shop
    - Uses auth.uid() for security
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'admins' 
    AND policyname = 'Admins can view other admins in their shop'
  ) THEN
    CREATE POLICY "Admins can view other admins in their shop"
      ON admins
      FOR SELECT
      TO authenticated
      USING (
        shop_id IN (
          SELECT shop_id 
          FROM admins 
          WHERE auth_user_id = auth.uid()
        )
      );
  END IF;
END $$;
