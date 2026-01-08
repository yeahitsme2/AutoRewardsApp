/*
  # Remove All Unused Indexes

  1. Changes
    - Drop all indexes that are not being used by queries
    - Reduces index maintenance overhead
    - Improves write performance (inserts/updates)
    - Indexes can be re-added later if query patterns change

  2. Indexes Removed by Category
    
    a) Audit Field Indexes (rarely queried):
       - idx_promotions_created_by
       - idx_reward_redemptions_created_by
       - idx_services_created_by
       - idx_shop_settings_updated_by
       - idx_appointments_confirmed_by
    
    b) Foreign Key Indexes (unused relationships):
       - idx_redemptions_customer_id
       - idx_redemptions_reward_item_id
       - idx_appointments_vehicle_id
    
    c) Boolean/Lookup Indexes (no active queries):
       - idx_customers_is_deactivated
       - idx_customers_is_admin
       - idx_promotions_promo_code
    
    d) Timestamp/Date Indexes (no date queries):
       - idx_appointments_created_at
       - idx_promotions_valid_dates

  3. Performance Impact
    - Faster writes (no index maintenance)
    - Reduced storage footprint
    - No negative impact since indexes are unused
    - Can be recreated if query patterns emerge

  4. Note
    - All primary keys and foreign key constraints remain intact
    - Only indexes are being removed, not the underlying data or relationships
*/

-- Drop audit field indexes
DROP INDEX IF EXISTS idx_promotions_created_by;
DROP INDEX IF EXISTS idx_reward_redemptions_created_by;
DROP INDEX IF EXISTS idx_services_created_by;
DROP INDEX IF EXISTS idx_shop_settings_updated_by;
DROP INDEX IF EXISTS idx_appointments_confirmed_by;

-- Drop foreign key indexes that are unused
DROP INDEX IF EXISTS idx_redemptions_customer_id;
DROP INDEX IF EXISTS idx_redemptions_reward_item_id;
DROP INDEX IF EXISTS idx_appointments_vehicle_id;

-- Drop boolean and lookup indexes
DROP INDEX IF EXISTS idx_customers_is_deactivated;
DROP INDEX IF EXISTS idx_customers_is_admin;
DROP INDEX IF EXISTS idx_promotions_promo_code;

-- Drop timestamp/date indexes
DROP INDEX IF EXISTS idx_appointments_created_at;
DROP INDEX IF EXISTS idx_promotions_valid_dates;
