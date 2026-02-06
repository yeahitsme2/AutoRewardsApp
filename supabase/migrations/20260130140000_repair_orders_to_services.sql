-- Integrate repair orders with service history and rewards

alter table if exists public.services
  add column if not exists source_type text,
  add column if not exists source_id uuid,
  add column if not exists mileage_at_service numeric,
  add column if not exists notes text;

create index if not exists services_source_idx on public.services (source_type, source_id);
