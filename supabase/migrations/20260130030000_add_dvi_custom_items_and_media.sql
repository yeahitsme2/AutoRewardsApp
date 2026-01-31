/*
  # DVI Custom Items + Media Enhancements

  - Adds custom item fields and recommendation status to dvi_report_items
  - Adds media metadata to dvi_item_media
  - Adds dvi_report_media for overall inspection attachments
*/

ALTER TABLE dvi_report_items
  ADD COLUMN IF NOT EXISTS is_custom boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_title text,
  ADD COLUMN IF NOT EXISTS custom_description text,
  ADD COLUMN IF NOT EXISTS custom_section text,
  ADD COLUMN IF NOT EXISTS recommendation_status text,
  ADD COLUMN IF NOT EXISTS suggested_for_template boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE dvi_item_media
  ADD COLUMN IF NOT EXISTS media_type text,
  ADD COLUMN IF NOT EXISTS duration_seconds integer,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS dvi_report_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES dvi_reports(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  file_size integer,
  media_type text,
  duration_seconds integer,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dvi_report_media_report_id ON dvi_report_media(report_id);

ALTER TABLE dvi_report_media ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='dvi_report_media'
      AND policyname='Admins manage dvi report media'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Admins manage dvi report media"
      ON dvi_report_media FOR ALL
      TO authenticated
      USING (EXISTS (
        SELECT 1
        FROM dvi_reports r
        JOIN admins a ON a.shop_id = r.shop_id
        WHERE r.id = dvi_report_media.report_id
          AND a.auth_user_id = auth.uid()
          AND a.is_active = true
      ))
      WITH CHECK (EXISTS (
        SELECT 1
        FROM dvi_reports r
        JOIN admins a ON a.shop_id = r.shop_id
        WHERE r.id = dvi_report_media.report_id
          AND a.auth_user_id = auth.uid()
          AND a.is_active = true
      ))
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='dvi_report_media'
      AND policyname='Customers view dvi report media'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Customers view dvi report media"
      ON dvi_report_media FOR SELECT
      TO authenticated
      USING (EXISTS (
        SELECT 1
        FROM dvi_reports r
        WHERE r.id = dvi_report_media.report_id
          AND r.status = 'published'
          AND r.customer_id IN (
            SELECT id FROM customers WHERE auth_user_id = auth.uid()
          )
      ))
    $policy$;
  END IF;
END $$;
