/*
  # Fix ambiguous template_id in default DVI report creation
*/

CREATE OR REPLACE FUNCTION create_default_dvi_report_for_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_template_id uuid;
  v_report_id uuid;
BEGIN
  SELECT id INTO v_template_id
  FROM dvi_templates
  WHERE shop_id = NEW.shop_id AND is_default
  LIMIT 1;
  IF v_template_id IS NULL THEN
    v_template_id := create_default_dvi_template_for_shop(NEW.shop_id);
  END IF;
  IF EXISTS (SELECT 1 FROM dvi_reports WHERE repair_order_id = NEW.id) THEN
    RETURN NEW;
  END IF;
  INSERT INTO dvi_reports (shop_id, repair_order_id, customer_id, vehicle_id, template_id, status)
  VALUES (NEW.shop_id, NEW.id, NEW.customer_id, NEW.vehicle_id, v_template_id, 'draft')
  RETURNING id INTO v_report_id;

  INSERT INTO dvi_report_items (report_id, template_item_id, condition)
  SELECT v_report_id, id, 'green'
  FROM dvi_template_items
  WHERE section_id IN (
    SELECT id FROM dvi_template_sections WHERE template_id = v_template_id
  );

  RETURN NEW;
END;
$$;
