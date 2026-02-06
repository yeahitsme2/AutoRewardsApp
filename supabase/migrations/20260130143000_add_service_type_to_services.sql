-- Ensure services table has service_type for RO service history

alter table if exists public.services
  add column if not exists service_type text;
