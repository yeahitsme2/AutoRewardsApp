/*
  # Fix Points Per Dollar to Support Decimals

  ## Changes Made

  ### 1. Change Column Type
  - Change `shop_settings.points_per_dollar` from `integer` to `numeric(10,2)`
  - This allows decimal values like 0.5, 1.5, etc.

  ## Notes
  - Existing integer values will be automatically converted to numeric
  - This enables more flexible reward configurations
*/

-- Change points_per_dollar from integer to numeric to support decimal values
ALTER TABLE shop_settings 
  ALTER COLUMN points_per_dollar TYPE numeric(10,2);
