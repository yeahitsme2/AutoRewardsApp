-- Inventory upgrade: parts metadata, parts needed workflow, PO linkage, and core tracking

alter table if exists public.parts
  add column if not exists vendor_id uuid,
  add column if not exists vendor_sku text,
  add column if not exists internal_sku text,
  add column if not exists category text,
  add column if not exists aliases text[],
  add column if not exists is_core boolean default false,
  add column if not exists core_charge numeric default 0;

alter table if exists public.part_locations
  add column if not exists bin text,
  add column if not exists reorder_min integer default 0,
  add column if not exists reorder_max integer default 0,
  add column if not exists avg_cost numeric default 0;

alter table if exists public.repair_order_part_reservations
  add column if not exists job_status text default 'needed',
  add column if not exists is_special_order boolean default false,
  add column if not exists po_line_id uuid,
  add column if not exists expected_at timestamptz,
  add column if not exists notes text,
  add column if not exists core_due boolean default false,
  add column if not exists core_returned_at timestamptz,
  add column if not exists vendor_id uuid;

alter table if exists public.purchase_order_lines
  add column if not exists reservation_id uuid;

create index if not exists parts_shop_name_idx on public.parts (shop_id, name);
create index if not exists parts_shop_sku_idx on public.parts (shop_id, sku);
create index if not exists part_locations_part_location_idx on public.part_locations (part_id, location_id);
create index if not exists ro_part_res_status_idx on public.repair_order_part_reservations (job_status);
create index if not exists ro_part_res_ro_idx on public.repair_order_part_reservations (repair_order_id);
create index if not exists ro_part_res_po_line_idx on public.repair_order_part_reservations (po_line_id);
create index if not exists po_lines_reservation_idx on public.purchase_order_lines (reservation_id);
