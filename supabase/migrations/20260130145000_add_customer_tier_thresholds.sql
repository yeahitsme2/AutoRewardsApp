-- Add tier_thresholds column if triggers/policies reference it

alter table if exists public.customers
  add column if not exists tier_thresholds jsonb;
