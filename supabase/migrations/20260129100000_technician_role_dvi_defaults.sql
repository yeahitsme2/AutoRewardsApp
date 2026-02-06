/*
  # Technician role + Default DVI workflow
*/

ALTER TABLE admins
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'admin';

ALTER TABLE dvi_templates
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_dvi_templates_shop_default ON dvi_templates(shop_id) WHERE is_default;

CREATE OR REPLACE FUNCTION create_default_dvi_template_for_shop(_shop_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  tmpl_id uuid;
  section_data jsonb;
  section_id uuid;
  item_title text;
  section_items jsonb;
BEGIN
  SELECT id INTO tmpl_id
  FROM dvi_templates
  WHERE shop_id = _shop_id AND is_default
  LIMIT 1;
  IF tmpl_id IS NOT NULL THEN
    RETURN tmpl_id;
  END IF;

  INSERT INTO dvi_templates (shop_id, name, is_active, is_default)
  VALUES (_shop_id, 'Default inspection checklist', true, true)
  RETURNING id INTO tmpl_id;

  FOR section_data IN
    SELECT * FROM jsonb_array_elements(
      jsonb_build_array(
        jsonb_build_object('label', 'Exterior', 'items', jsonb_build_array('Body', 'Paint/Glass', 'Doors', 'Wipers')),
        jsonb_build_object('label', 'Interior', 'items', jsonb_build_array('Seats', 'Carpet', 'HVAC', 'Safety Belt')),
        jsonb_build_object('label', 'Dashboard', 'items', jsonb_build_array('Gauges', 'Warning Lights', 'Infotainment', 'Controls')),
        jsonb_build_object('label', 'Lights', 'items', jsonb_build_array('Headlights', 'Tail Lights', 'Indicators', 'Fog Lights')),
        jsonb_build_object('label', 'Tires', 'items', jsonb_build_array('Tread Depth', 'Pressure', 'Sidewalls', 'Wheel Alignment'))
      )
    )
  LOOP
    section_items := section_data->'items';
    INSERT INTO dvi_template_sections (template_id, title, sort_order)
    VALUES (tmpl_id, section_data->>'label', COALESCE((SELECT MAX(sort_order) FROM dvi_template_sections WHERE template_id = tmpl_id), 0) + 1)
    RETURNING id INTO section_id;
    FOR item_title IN SELECT jsonb_array_elements_text(section_items)
    LOOP
      INSERT INTO dvi_template_items (section_id, title, sort_order)
      VALUES (section_id, item_title, COALESCE((SELECT MAX(sort_order) FROM dvi_template_items WHERE section_id = section_id), 0) + 1);
    END LOOP;
  END LOOP;

  RETURN tmpl_id;
END;
$$;

CREATE OR REPLACE FUNCTION ensure_default_dvi_template_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM create_default_dvi_template_for_shop(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_create_default_dvi_template ON shops;
CREATE TRIGGER trigger_create_default_dvi_template
AFTER INSERT ON shops
FOR EACH ROW
EXECUTE FUNCTION ensure_default_dvi_template_trigger();

CREATE OR REPLACE FUNCTION create_default_dvi_report_for_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  template_id uuid;
  report_id uuid;
BEGIN
  SELECT id INTO template_id
  FROM dvi_templates
  WHERE shop_id = NEW.shop_id AND is_default
  LIMIT 1;
  IF template_id IS NULL THEN
    template_id := create_default_dvi_template_for_shop(NEW.shop_id);
  END IF;
  IF EXISTS (SELECT 1 FROM dvi_reports WHERE repair_order_id = NEW.id) THEN
    RETURN NEW;
  END IF;
  INSERT INTO dvi_reports (shop_id, repair_order_id, customer_id, vehicle_id, template_id, status)
  VALUES (NEW.shop_id, NEW.id, NEW.customer_id, NEW.vehicle_id, template_id, 'draft')
  RETURNING id INTO report_id;

  INSERT INTO dvi_report_items (report_id, template_item_id, condition)
  SELECT report_id, id, 'green'
  FROM dvi_template_items
  WHERE section_id IN (
    SELECT id FROM dvi_template_sections WHERE template_id = template_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_create_default_dvi_report ON repair_orders;
CREATE TRIGGER trigger_create_default_dvi_report
AFTER INSERT ON repair_orders
FOR EACH ROW
EXECUTE FUNCTION create_default_dvi_report_for_order();
