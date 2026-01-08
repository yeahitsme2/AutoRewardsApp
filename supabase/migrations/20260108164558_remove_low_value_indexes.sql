/*
  # Remove Low-Value Indexes

  1. Changes
    - Drop indexes on low-selectivity boolean fields
    - Keep indexes that are useful for foreign keys and high-selectivity queries
    - Remove indexes that add maintenance overhead without performance benefit

  2. Indexes Removed
    - idx_customer_promotions_is_read (low selectivity boolean)
    - idx_customer_promotions_is_used (low selectivity boolean)
    - idx_promotions_active (low selectivity boolean)

  3. Indexes Kept
    - All foreign key indexes (essential for join performance)
    - Date/time indexes (useful for sorting and filtering)
    - idx_customers_is_admin (highly skewed, useful for admin queries)
    - idx_customers_is_deactivated (highly skewed, useful for active customer queries)
    - idx_promotions_promo_code (useful for promo code lookups)
    - idx_promotions_valid_dates (useful for date range queries)

  4. Rationale
    - Boolean fields with low selectivity don't benefit from indexes
    - Foreign key indexes are critical for join performance
    - Date indexes are useful for sorting and date range queries
    - Highly skewed boolean fields (like is_admin) are kept as they help filter small result sets
*/

-- Drop low-selectivity boolean indexes
DROP INDEX IF EXISTS idx_customer_promotions_is_read;
DROP INDEX IF EXISTS idx_customer_promotions_is_used;
DROP INDEX IF EXISTS idx_promotions_active;
