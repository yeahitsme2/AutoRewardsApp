create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  recipient_role text not null,
  recipient_id uuid null,
  title text not null,
  body text null,
  entity_type text null,
  entity_id uuid null,
  action_url text null,
  is_read boolean not null default false,
  read_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists notifications_shop_id_idx on public.notifications(shop_id);
create index if not exists notifications_recipient_id_idx on public.notifications(recipient_id);
create index if not exists notifications_created_at_idx on public.notifications(created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "Admins can view shop notifications" on public.notifications;
create policy "Admins can view shop notifications"
  on public.notifications for select
  using (is_admin_for_shop_secure(shop_id));

drop policy if exists "Admins can insert shop notifications" on public.notifications;
create policy "Admins can insert shop notifications"
  on public.notifications for insert
  with check (is_admin_for_shop_secure(shop_id));

drop policy if exists "Admins can update shop notifications" on public.notifications;
create policy "Admins can update shop notifications"
  on public.notifications for update
  using (is_admin_for_shop_secure(shop_id))
  with check (is_admin_for_shop_secure(shop_id));

drop policy if exists "Customers can view own notifications" on public.notifications;
create policy "Customers can view own notifications"
  on public.notifications for select
  using (recipient_role = 'customer' and recipient_id = auth.uid());

drop policy if exists "Customers can mark own notifications read" on public.notifications;
create policy "Customers can mark own notifications read"
  on public.notifications for update
  using (recipient_role = 'customer' and recipient_id = auth.uid())
  with check (recipient_role = 'customer' and recipient_id = auth.uid());

drop policy if exists "Customers can notify admins" on public.notifications;
create policy "Customers can notify admins"
  on public.notifications for insert
  with check (
    recipient_role = 'admin'
    and shop_id = get_user_shop_id()
    and recipient_id is null
  );
