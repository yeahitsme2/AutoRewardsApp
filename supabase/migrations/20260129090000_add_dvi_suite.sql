/*
  # Add DVI Suite + Audit Events
*/

-- Audit events
CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  actor_auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role text,
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_shop_id ON audit_events(shop_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON audit_events(entity_type, entity_id);

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- DVI templates
CREATE TABLE IF NOT EXISTS dvi_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dvi_template_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES dvi_templates(id) ON DELETE CASCADE,
  title text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dvi_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES dvi_template_sections(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  default_recommendation text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- DVI reports
CREATE TABLE IF NOT EXISTS dvi_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  repair_order_id uuid NOT NULL REFERENCES repair_orders(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  template_id uuid REFERENCES dvi_templates(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('draft','published')) DEFAULT 'draft',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

CREATE TABLE IF NOT EXISTS dvi_report_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES dvi_reports(id) ON DELETE CASCADE,
  template_item_id uuid REFERENCES dvi_template_items(id) ON DELETE SET NULL,
  condition text NOT NULL CHECK (condition IN ('green','yellow','red')) DEFAULT 'green',
  notes text,
  recommendation text,
  repair_order_item_id uuid REFERENCES repair_order_items(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dvi_item_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_item_id uuid NOT NULL REFERENCES dvi_report_items(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  file_size integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dvi_templates_shop_id ON dvi_templates(shop_id);
CREATE INDEX IF NOT EXISTS idx_dvi_reports_ro_id ON dvi_reports(repair_order_id);
CREATE INDEX IF NOT EXISTS idx_dvi_reports_customer_id ON dvi_reports(customer_id);
CREATE INDEX IF NOT EXISTS idx_dvi_report_items_report_id ON dvi_report_items(report_id);

ALTER TABLE dvi_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE dvi_template_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE dvi_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE dvi_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE dvi_report_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE dvi_item_media ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- audit events
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='audit_events' AND policyname='Admins read audit events') THEN
    EXECUTE $policy$
      CREATE POLICY "Admins read audit events"
      ON audit_events FOR SELECT
      TO authenticated
      USING (EXISTS (SELECT 1 FROM admins WHERE admins.auth_user_id = auth.uid() AND admins.shop_id = audit_events.shop_id AND admins.is_active = true))
    $policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='audit_events' AND policyname='Admins insert audit events') THEN
    EXECUTE $policy$
      CREATE POLICY "Admins insert audit events"
      ON audit_events FOR INSERT
      TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM admins WHERE admins.auth_user_id = auth.uid() AND admins.shop_id = audit_events.shop_id AND admins.is_active = true))
    $policy$;
  END IF;

  -- templates
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dvi_templates' AND policyname='Admins manage dvi templates') THEN
    EXECUTE $policy$
      CREATE POLICY "Admins manage dvi templates"
      ON dvi_templates FOR ALL
      TO authenticated
      USING (EXISTS (SELECT 1 FROM admins WHERE admins.auth_user_id = auth.uid() AND admins.shop_id = dvi_templates.shop_id AND admins.is_active = true))
      WITH CHECK (EXISTS (SELECT 1 FROM admins WHERE admins.auth_user_id = auth.uid() AND admins.shop_id = dvi_templates.shop_id AND admins.is_active = true))
    $policy$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dvi_template_sections' AND policyname='Admins manage dvi template sections') THEN
    EXECUTE $policy$
      CREATE POLICY "Admins manage dvi template sections"
      ON dvi_template_sections FOR ALL
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM dvi_templates t
        JOIN admins a ON a.shop_id = t.shop_id
        WHERE t.id = dvi_template_sections.template_id AND a.auth_user_id = auth.uid() AND a.is_active = true
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM dvi_templates t
        JOIN admins a ON a.shop_id = t.shop_id
        WHERE t.id = dvi_template_sections.template_id AND a.auth_user_id = auth.uid() AND a.is_active = true
      ))
    $policy$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dvi_template_items' AND policyname='Admins manage dvi template items') THEN
    EXECUTE $policy$
      CREATE POLICY "Admins manage dvi template items"
      ON dvi_template_items FOR ALL
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM dvi_template_sections s
        JOIN dvi_templates t ON t.id = s.template_id
        JOIN admins a ON a.shop_id = t.shop_id
        WHERE s.id = dvi_template_items.section_id AND a.auth_user_id = auth.uid() AND a.is_active = true
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM dvi_template_sections s
        JOIN dvi_templates t ON t.id = s.template_id
        JOIN admins a ON a.shop_id = t.shop_id
        WHERE s.id = dvi_template_items.section_id AND a.auth_user_id = auth.uid() AND a.is_active = true
      ))
    $policy$;
  END IF;

  -- reports
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dvi_reports' AND policyname='Admins manage dvi reports') THEN
    EXECUTE $policy$
      CREATE POLICY "Admins manage dvi reports"
      ON dvi_reports FOR ALL
      TO authenticated
      USING (EXISTS (SELECT 1 FROM admins WHERE admins.auth_user_id = auth.uid() AND admins.shop_id = dvi_reports.shop_id AND admins.is_active = true))
      WITH CHECK (EXISTS (SELECT 1 FROM admins WHERE admins.auth_user_id = auth.uid() AND admins.shop_id = dvi_reports.shop_id AND admins.is_active = true))
    $policy$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dvi_reports' AND policyname='Customers view published dvi reports') THEN
    EXECUTE $policy$
      CREATE POLICY "Customers view published dvi reports"
      ON dvi_reports FOR SELECT
      TO authenticated
      USING (
        status = 'published'
        AND customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid())
      )
    $policy$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dvi_report_items' AND policyname='Admins manage dvi report items') THEN
    EXECUTE $policy$
      CREATE POLICY "Admins manage dvi report items"
      ON dvi_report_items FOR ALL
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM dvi_reports r
        JOIN admins a ON a.shop_id = r.shop_id
        WHERE r.id = dvi_report_items.report_id AND a.auth_user_id = auth.uid() AND a.is_active = true
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM dvi_reports r
        JOIN admins a ON a.shop_id = r.shop_id
        WHERE r.id = dvi_report_items.report_id AND a.auth_user_id = auth.uid() AND a.is_active = true
      ))
    $policy$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dvi_report_items' AND policyname='Customers view items for published reports') THEN
    EXECUTE $policy$
      CREATE POLICY "Customers view items for published reports"
      ON dvi_report_items FOR SELECT
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM dvi_reports r
        WHERE r.id = dvi_report_items.report_id
          AND r.status = 'published'
          AND r.customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid())
      ))
    $policy$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dvi_item_media' AND policyname='Admins manage dvi media') THEN
    EXECUTE $policy$
      CREATE POLICY "Admins manage dvi media"
      ON dvi_item_media FOR ALL
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM dvi_report_items i
        JOIN dvi_reports r ON r.id = i.report_id
        JOIN admins a ON a.shop_id = r.shop_id
        WHERE i.id = dvi_item_media.report_item_id AND a.auth_user_id = auth.uid() AND a.is_active = true
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM dvi_report_items i
        JOIN dvi_reports r ON r.id = i.report_id
        JOIN admins a ON a.shop_id = r.shop_id
        WHERE i.id = dvi_item_media.report_item_id AND a.auth_user_id = auth.uid() AND a.is_active = true
      ))
    $policy$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dvi_item_media' AND policyname='Customers view dvi media') THEN
    EXECUTE $policy$
      CREATE POLICY "Customers view dvi media"
      ON dvi_item_media FOR SELECT
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM dvi_report_items i
        JOIN dvi_reports r ON r.id = i.report_id
        WHERE i.id = dvi_item_media.report_item_id
          AND r.status = 'published'
          AND r.customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid())
      ))
    $policy$;
  END IF;
END $$;
