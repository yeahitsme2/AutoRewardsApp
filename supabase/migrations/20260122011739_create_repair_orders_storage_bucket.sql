/*
  # Create Repair Orders Storage Bucket

  1. Storage Setup
    - Create 'repair-orders' storage bucket for PDF documents
    - Set bucket to private (requires authentication)
    - Enable file size limits for security (10MB max)
  
  2. Security Policies
    - Super admins can manage all files across all shops
    - Shop admins can upload, view, and delete files for their shop only
    - Customers cannot access repair order files directly (admin-only feature)
  
  3. Storage Organization
    - Files are organized by shop_id: {shop_id}/{filename}
    - This ensures proper multi-tenant isolation
*/

-- Create the repair-orders storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'repair-orders',
  'repair-orders',
  false,
  10485760,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Allow super admins to manage all files
CREATE POLICY "Super admins can manage all repair order files"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'repair-orders' AND
  EXISTS (
    SELECT 1 FROM super_admins
    WHERE super_admins.id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'repair-orders' AND
  EXISTS (
    SELECT 1 FROM super_admins
    WHERE super_admins.id = auth.uid()
  )
);

-- Allow shop admins to upload files to their shop folder
CREATE POLICY "Shop admins can upload repair order files to their shop"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'repair-orders' AND
  EXISTS (
    SELECT 1 FROM admins
    WHERE admins.auth_user_id = auth.uid()
    AND (storage.foldername(name))[1] = admins.shop_id::text
  )
);

-- Allow shop admins to view files in their shop folder
CREATE POLICY "Shop admins can view repair order files in their shop"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'repair-orders' AND
  EXISTS (
    SELECT 1 FROM admins
    WHERE admins.auth_user_id = auth.uid()
    AND (storage.foldername(name))[1] = admins.shop_id::text
  )
);

-- Allow shop admins to update files in their shop folder
CREATE POLICY "Shop admins can update repair order files in their shop"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'repair-orders' AND
  EXISTS (
    SELECT 1 FROM admins
    WHERE admins.auth_user_id = auth.uid()
    AND (storage.foldername(name))[1] = admins.shop_id::text
  )
)
WITH CHECK (
  bucket_id = 'repair-orders' AND
  EXISTS (
    SELECT 1 FROM admins
    WHERE admins.auth_user_id = auth.uid()
    AND (storage.foldername(name))[1] = admins.shop_id::text
  )
);

-- Allow shop admins to delete files from their shop folder
CREATE POLICY "Shop admins can delete repair order files from their shop"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'repair-orders' AND
  EXISTS (
    SELECT 1 FROM admins
    WHERE admins.auth_user_id = auth.uid()
    AND (storage.foldername(name))[1] = admins.shop_id::text
  )
);
