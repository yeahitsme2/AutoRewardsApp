# Feature Expansion (DVI, Scheduling, Inventory, Communications)

## Required Environment Variables
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_PUBLIC_APP_URL` (optional, used for QR links)
- Optional SMS/email provider settings (stubbed in UI only):
  - `VITE_SMS_PROVIDER` (if you wire a provider)
  - `VITE_EMAIL_PROVIDER` (if you wire a provider)

## Storage Buckets
Create these buckets in Supabase Storage if they do not exist:
- `dvi-attachments`
- `chat-attachments`

## How to Run Migrations Manually
Run these in order (each is additive and safe):
1. `supabase/migrations/20260129090000_add_dvi_suite.sql`
2. `supabase/migrations/20260129091000_add_scheduling_plus_locations.sql`
3. `supabase/migrations/20260129092000_add_inventory_management.sql`
4. `supabase/migrations/20260129093000_add_comms_chat_sms.sql`

In Supabase SQL Editor, paste each file contents in order and run. Do not reorder.

## Test Checklist (Critical Flows)
1. DVI Suite
   - Create a DVI template, add sections/items.
   - Create a DVI report for an RO, update findings, publish.
   - Verify customer portal shows the published DVI and media attachments.
2. Scheduling
   - Create appointment types and a shop location.
   - Book an appointment as a customer and verify capacity rules are honored.
   - Confirm reminders are created in `appointment_reminders` and an outbound email log entry is created.
3. Inventory
   - Add a part and stock it at a location.
   - Reserve parts on an RO and verify `inventory_transactions` updates.
   - Close the RO and confirm reserved parts are consumed.
4. Communications
   - Send a chat message from admin and customer; verify internal thread is not visible to customers.
   - Toggle SMS opt-out on the customer messages screen and verify `sms_opt_out` is updated.
   - Check SMS usage rollup in Settings > Communications.

## Test Accounts / Seed Data
- Admin: create via existing admin tooling.
- Customer: create via customer signup or SQL insert into `customers` (ensure `shop_id` is set).
- Minimum setup: one `shop`, one `shop_settings`, one `shop_location`, one `customer`, one `vehicle`.
