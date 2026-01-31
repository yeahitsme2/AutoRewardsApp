alter table if exists public.dvi_reports
  add column if not exists mileage_at_service numeric;
