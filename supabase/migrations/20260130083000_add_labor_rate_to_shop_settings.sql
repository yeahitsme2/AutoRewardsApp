/*
  # Add labor rate to shop settings
*/

ALTER TABLE shop_settings
  ADD COLUMN IF NOT EXISTS labor_rate numeric;
