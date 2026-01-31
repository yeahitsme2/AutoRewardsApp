create table if not exists public.closeout_snapshots (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  location_id uuid null references public.shop_locations(id) on delete set null,
  period_type text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'draft',
  totals_json jsonb not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  finalized_by uuid null,
  finalized_at timestamptz null
);

create index if not exists closeout_snapshots_shop_id_idx on public.closeout_snapshots(shop_id);
create index if not exists closeout_snapshots_date_range_idx on public.closeout_snapshots(start_date, end_date);
create index if not exists closeout_snapshots_status_idx on public.closeout_snapshots(status);

alter table public.closeout_snapshots enable row level security;

drop policy if exists "Admins can view closeout snapshots" on public.closeout_snapshots;
create policy "Admins can view closeout snapshots"
  on public.closeout_snapshots for select
  using (is_admin_for_shop_secure(shop_id));

drop policy if exists "Admins can insert closeout snapshots" on public.closeout_snapshots;
create policy "Admins can insert closeout snapshots"
  on public.closeout_snapshots for insert
  with check (is_admin_for_shop_secure(shop_id));

drop policy if exists "Admins can update closeout snapshots" on public.closeout_snapshots;
create policy "Admins can update closeout snapshots"
  on public.closeout_snapshots for update
  using (is_admin_for_shop_secure(shop_id))
  with check (is_admin_for_shop_secure(shop_id));

drop policy if exists "Super admins can view closeout snapshots" on public.closeout_snapshots;
create policy "Super admins can view closeout snapshots"
  on public.closeout_snapshots for select
  using (is_super_admin());

drop policy if exists "Super admins can insert closeout snapshots" on public.closeout_snapshots;
create policy "Super admins can insert closeout snapshots"
  on public.closeout_snapshots for insert
  with check (is_super_admin());

drop policy if exists "Super admins can update closeout snapshots" on public.closeout_snapshots;
create policy "Super admins can update closeout snapshots"
  on public.closeout_snapshots for update
  using (is_super_admin())
  with check (is_super_admin());
