-- Add tier multiplier to customers for rewards calculations

alter table if exists public.customers
  add column if not exists tier_multiplier numeric;
