-- Ensure customers table has updated_at column for reward sync

alter table if exists public.customers
  add column if not exists updated_at timestamptz;
