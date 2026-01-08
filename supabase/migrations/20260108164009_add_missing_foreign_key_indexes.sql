/*
  # Add Missing Foreign Key Indexes

  1. Performance Improvements
    - Add index on appointments.confirmed_by for FK lookups
    - Add index on promotions.created_by for FK lookups
    - Add index on reward_redemptions.created_by for FK lookups
    - Add index on services.created_by for FK lookups
    - Add index on shop_settings.updated_by for FK lookups

  2. Benefits
    - Improves query performance for foreign key constraints
    - Speeds up JOIN operations on these columns
    - Reduces database load for relationship queries
*/

-- Add index for appointments confirmed_by foreign key
CREATE INDEX IF NOT EXISTS idx_appointments_confirmed_by 
  ON appointments(confirmed_by);

-- Add index for promotions created_by foreign key
CREATE INDEX IF NOT EXISTS idx_promotions_created_by 
  ON promotions(created_by);

-- Add index for reward_redemptions created_by foreign key
CREATE INDEX IF NOT EXISTS idx_reward_redemptions_created_by 
  ON reward_redemptions(created_by);

-- Add index for services created_by foreign key
CREATE INDEX IF NOT EXISTS idx_services_created_by 
  ON services(created_by);

-- Add index for shop_settings updated_by foreign key
CREATE INDEX IF NOT EXISTS idx_shop_settings_updated_by 
  ON shop_settings(updated_by);
