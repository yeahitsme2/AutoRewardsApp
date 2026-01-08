/*
  # Add Branding Customization to Shop Settings

  ## Overview
  This migration adds branding customization fields to the shop_settings table,
  allowing businesses to personalize their auto shop management system.

  ## Changes Made

  1. **New Branding Fields**
     - `shop_logo_url` (text): URL to the shop's logo image
     - `primary_color` (text): Primary brand color (hex code, default: #10b981 - emerald)
     - `secondary_color` (text): Secondary brand color (hex code, default: #059669)
     - `accent_color` (text): Accent/highlight color (hex code, default: #047857)

  2. **Usage**
     - Shop logo will replace default wrench icon throughout the app
     - Colors will be applied dynamically to buttons, badges, and UI elements
     - Each business can create their unique branded experience

  ## Default Values
  - Logo: null (will show default icon)
  - Primary: #10b981 (emerald-500)
  - Secondary: #059669 (emerald-600)
  - Accent: #047857 (emerald-700)
*/

-- Add branding fields to shop_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_settings' AND column_name = 'shop_logo_url'
  ) THEN
    ALTER TABLE shop_settings ADD COLUMN shop_logo_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_settings' AND column_name = 'primary_color'
  ) THEN
    ALTER TABLE shop_settings ADD COLUMN primary_color text DEFAULT '#10b981';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_settings' AND column_name = 'secondary_color'
  ) THEN
    ALTER TABLE shop_settings ADD COLUMN secondary_color text DEFAULT '#059669';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_settings' AND column_name = 'accent_color'
  ) THEN
    ALTER TABLE shop_settings ADD COLUMN accent_color text DEFAULT '#047857';
  END IF;
END $$;

-- Update all existing rows with default colors if they don't have values
UPDATE shop_settings
SET 
  primary_color = COALESCE(primary_color, '#10b981'),
  secondary_color = COALESCE(secondary_color, '#059669'),
  accent_color = COALESCE(accent_color, '#047857');