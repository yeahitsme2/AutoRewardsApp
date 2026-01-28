/*
  # Add tax settings to shop_settings

  1. New fields
     - tax_rate: stored percent rate (e.g., 7.5)
     - taxable_item_types: array of item types that should be taxed by default
*/

ALTER TABLE shop_settings
  ADD COLUMN IF NOT EXISTS tax_rate numeric(10,2) DEFAULT 0;

ALTER TABLE shop_settings
  ADD COLUMN IF NOT EXISTS taxable_item_types text[] DEFAULT ARRAY['part'];
