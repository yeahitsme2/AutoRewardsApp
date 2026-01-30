-- Add tier_thresholds JSONB to shop_settings for tier update trigger

alter table if exists public.shop_settings
  add column if not exists tier_thresholds jsonb;
