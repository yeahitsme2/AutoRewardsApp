/*
  # Add Custom Text Fields to Shop Settings

  ## Overview
  This migration adds customizable text fields to shop_settings, allowing admins to personalize
  the application header and welcome message.

  ## Changes Made

  1. **New Text Fields**
     - `header_text` (text): Customizable header text shown in the dashboard (default: "Auto Shop Rewards")
     - `welcome_message` (text): Customizable welcome message for customers (default: "Welcome back")

  2. **Usage**
     - Header text replaces "Auto Shop Rewards" in the customer dashboard
     - Welcome message replaces "Welcome back" in the greeting

  3. **Benefits**
     - Allows businesses to use their own branding and terminology
     - Creates a more personalized customer experience
     - Supports multi-shop/franchise customization

  ## Default Values
  - Header Text: "Auto Shop Rewards"
  - Welcome Message: "Welcome back"
*/

-- Add custom text fields to shop_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_settings' AND column_name = 'header_text'
  ) THEN
    ALTER TABLE shop_settings ADD COLUMN header_text text DEFAULT 'Auto Shop Rewards';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_settings' AND column_name = 'welcome_message'
  ) THEN
    ALTER TABLE shop_settings ADD COLUMN welcome_message text DEFAULT 'Welcome back';
  END IF;
END $$;

-- Update all existing rows with default text if they don't have values
UPDATE shop_settings
SET 
  header_text = COALESCE(header_text, 'Auto Shop Rewards'),
  welcome_message = COALESCE(welcome_message, 'Welcome back');