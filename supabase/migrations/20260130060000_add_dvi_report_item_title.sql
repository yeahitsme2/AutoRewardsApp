/*
  # Store template item title on report items for customer display
*/

ALTER TABLE dvi_report_items
  ADD COLUMN IF NOT EXISTS item_title text;

UPDATE dvi_report_items ri
SET item_title = ti.title
FROM dvi_template_items ti
WHERE ri.template_item_id = ti.id
  AND ri.item_title IS NULL;
