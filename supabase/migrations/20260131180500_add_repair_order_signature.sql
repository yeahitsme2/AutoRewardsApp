alter table public.repair_orders
  add column if not exists customer_signature text,
  add column if not exists customer_signature_name text,
  add column if not exists customer_signature_status text,
  add column if not exists customer_signature_at timestamptz,
  add column if not exists has_signature boolean not null default false;
