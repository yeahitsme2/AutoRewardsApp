create unique index if not exists services_unique_repair_order_source_idx
  on public.services (source_type, source_id)
  where source_type = 'repair_order' and source_id is not null;
