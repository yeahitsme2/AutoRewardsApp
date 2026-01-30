/*
  # Fix ambiguous section_id in default DVI template creation
*/

CREATE OR REPLACE FUNCTION create_default_dvi_template_for_shop(_shop_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  tmpl_id uuid;
  section_data jsonb;
  v_section_id uuid;
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
    VALUES (
      tmpl_id,
      section_data->>'label',
      COALESCE((SELECT MAX(sort_order) FROM dvi_template_sections WHERE template_id = tmpl_id), 0) + 1
    )
    RETURNING id INTO v_section_id;
    FOR item_title IN SELECT jsonb_array_elements_text(section_items)
    LOOP
      INSERT INTO dvi_template_items (section_id, title, sort_order)
      VALUES (
        v_section_id,
        item_title,
        COALESCE((SELECT MAX(sort_order) FROM dvi_template_items WHERE dvi_template_items.section_id = v_section_id), 0) + 1
      );
    END LOOP;
  END LOOP;

  RETURN tmpl_id;
END;
$$;
