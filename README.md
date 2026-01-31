# DriveRewards v2.0

DriveRewards v2.0 is an end-to-end shop management and customer engagement platform for automotive service businesses. It combines repair orders, DVI inspections, inventory, messaging, and rewards into a single workflow so advisors and technicians can move faster while customers get clear approvals and updates.

## V2.0 Highlights

### Shop Management
- Repair Order lifecycle: draft ? awaiting approval ? approved/declined ? inspection complete ? closed
- Nested line items (labor + parts) with approvals, declines, and reinstatement
- Real-time updates for approvals, messaging, and appointment changes
- Closeouts (End-of-Day/Week/Month) previews with export/print

### DVI & Technician Workflow
- Template-driven inspections with custom items
- Photo/video/audio/text evidence per item
- Publish flow with customer-facing report
- Technician-focused dashboard and inspection history

### Inventory v2
- Parts Needed inbox tied to open ROs
- Purchase orders, receiving, returns, cores
- Stock counts/adjustments (supports negative adjustments)
- RO-linked reservations to reduce parts chaos

### Customer Experience
- Customer portal with RO approvals, chat, and DVI report access
- Digital signature capture on approvals/declines
- Customer profile + address management
- Rewards, promotions, and service history

### Notifications
- In-app notification center (admin + customer)
- Real-time updates via Supabase Realtime
- Optional push notification support (VAPID)

## V2.1 (Coming Soon)

- Square Payments integration
- SMS messaging
- Email messaging
- Refined repair order experience
- Push notifications fully enabled end-to-end

## V2.5 (Coming Soon)

- Integrated parts and tires ordering
- Direct repair order push to vendors

## Tech Stack

- React + Vite + TypeScript
- Supabase (Auth, Postgres, Storage, Edge Functions, Realtime)
- Tailwind CSS
- Capacitor (mobile builds)

## Environment Variables

Client (Vite):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_VAPID_PUBLIC_KEY` (if push is enabled)

Server / Edge Functions:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` (push)

## Supabase Functions

Deploy as needed:
```
supabase functions deploy create-admin
supabase functions deploy send-push
supabase functions deploy closeouts-preview-public --no-verify-jwt
```

Note: `closeouts-preview-public` must be deployed with `--no-verify-jwt` or have Verify JWT disabled in the dashboard.

## Database Migrations (V2.0)

Run new migrations before testing:
- `20260130164000_add_dvi_report_mileage.sql`
- `20260130172000_add_notifications.sql`
- `20260130180000_add_services_unique_ro_source.sql`
- `20260130193000_add_customer_address_fields.sql`
- `20260131090000_add_closeout_snapshots.sql`
- `20260131180500_add_repair_order_signature.sql`

## Scripts

```
npm run dev
npm run build
npm run test
npm run typecheck
```

## Main Branch Merge Checklist (V2.0)

- [ ] All V2.0 migrations applied in Supabase
- [ ] Edge Functions deployed (create-admin, send-push, closeouts-preview-public)
- [ ] Verify JWT OFF for closeouts-preview-public
- [ ] Vercel env vars set for client
- [ ] Push notification keys set (if used)
- [ ] Smoke test: RO approvals + signature, DVI publish, closeouts preview, inventory counts
