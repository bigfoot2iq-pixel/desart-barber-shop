# Implementation Plan — Customer Email Notifications for Admin-Initiated Appointment Events

> Audience: the AI agent that will implement this. Read every section before touching code. Builds on top of the existing admin notification system documented in `NOTIFICATIONS_PLAN.md`. Current repo state as of branch `master`, after migration `014`.

## 0. Context the implementer must know before touching code

- This is Next.js **16.2.4** (App Router). Per `AGENTS.md`, read the relevant guide under `node_modules/next/dist/docs/` before writing any route/server-action code — APIs have drifted from prior versions.
- The admin notification system is already in place: see `NOTIFICATIONS_PLAN.md`, `lib/notifications/`, `app/api/notifications/`, migrations `012`–`013`.
- Appointments mutate from the browser via `lib/queries/appointments.ts`: customers call `createAppointment` / `cancelAppointment`; admins call `assignProfessionalToAppointment` / `updateAppointmentStatus` from `app/admin/components/AppointmentsManager.tsx`. All mutations are client-side using the user's Supabase session (RLS enforced).
- Dispatch is driven by a Supabase **Database Webhook** on `appointments` INSERT/UPDATE → `POST /api/notifications/appointment-webhook` → `lib/notifications/index.ts#dispatchEvent`. We extend that same webhook; do not add a new one.
- Admin auth pattern to copy verbatim for any new admin-only route: `app/api/professionals/route.ts` L6–L16. The authoritative check is **`user.app_metadata.role === 'admin'`** — NOT `profiles.role` (that column is RLS-writable by the user and is explicitly unsafe, per migration `008_security_fixes.sql`).
- Service-role Supabase client used by the webhook: `lib/supabase/service.ts` via `createServiceClient()`. Do not reuse `lib/supabase/server.ts` (cookie-scoped).
- Secrets are plaintext in JSONB (same stance as `notification_channels`). Acceptable MVP trade-off — add a `TODO: encrypt with pgsodium` comment in any new migration that holds secrets.

## 1. Scope

Send a customer-facing email when the **admin** (or any non-customer actor) changes an appointment the customer owns:

| Event | Send to customer? | Rationale |
|---|---|---|
| `appointment.confirmed` (admin confirms pending) | ✅ yes | Customer needs to know their slot is secured |
| `appointment.cancelled` by **admin** | ✅ yes | Customer needs to know their slot is gone |
| `appointment.cancelled` by **customer themselves** | ❌ no | They just clicked the button — redundant |
| `appointment.created` | ❌ no (MVP) | Customer just saw the confirmation screen |
| `appointment.completed` | ❌ no (MVP) | Out of scope; possible future "leave a review" hook |
| `appointment.professional_assigned` | ❌ no (MVP) | Out of scope |

**Channel:** email only. No WhatsApp, no Telegram. Reuse the existing Resend adapter.

## 2. The core problem — distinguishing *who* triggered the status change

Supabase DB webhooks deliver `{ record, old_record }` with **no actor info**. We cannot tell an admin cancel apart from a customer self-cancel today. Fix at the DB layer.

### Migration `015_appointments_updated_by.sql`

```sql
-- Track who last modified an appointment row so notification dispatch can
-- distinguish customer self-service actions from admin/professional actions.

ALTER TABLE public.appointments
  ADD COLUMN updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Backfill existing rows: assume the customer did it. This prevents
-- spurious customer emails for historical rows on first webhook fire
-- after migration.
UPDATE public.appointments SET updated_by = customer_id WHERE updated_by IS NULL;

-- Trigger: on INSERT or UPDATE from a user session, stamp updated_by with
-- auth.uid(). Service-role calls have auth.uid() = NULL and will NOT
-- overwrite the column, which is the behavior we want.
CREATE OR REPLACE FUNCTION public.set_appointment_updated_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.updated_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER appointments_set_updated_by
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_appointment_updated_by();
```

- `updated_by` is a normal column — Supabase webhooks will include it in `record` automatically.
- Decision rule in the webhook: **send to customer only if `record.updated_by IS NOT NULL AND record.updated_by != record.customer_id`**. Covers "admin did it" and "professional did it" without hardcoding roles.
- Re-notification across genuine transitions (pending → confirmed → cancelled → confirmed): each emits a new `updated_at`, so dedup works as in migration `013`.

## 3. Config model — where customer email settings live

**Do not** reuse `notification_channels`. That table means "one config row, all admins get every event at a fixed destination." Customer emails have a dynamic per-appointment recipient and a different audience. Keep them separate.

### Migration `016_customer_notification_settings.sql`

```sql
-- Singleton-ish: one row holds all customer email settings.
-- Provider is hard-coded to Resend (email-only, MVP).
CREATE TABLE public.customer_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  resend_api_key TEXT NOT NULL,   -- TODO: encrypt with pgsodium
  from_address TEXT NOT NULL,     -- e.g. "DesArt <no-reply@yourdomain.com>"
  events TEXT[] NOT NULL DEFAULT ARRAY[
    'appointment.confirmed',
    'appointment.cancelled'
  ],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_customer_notification_settings_updated_at
  BEFORE UPDATE ON public.customer_notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.customer_notification_settings ENABLE ROW LEVEL SECURITY;

-- Same admin-only pattern as notification_channels (see migration 012).
CREATE POLICY "customer_notification_settings: admins can read"
  ON public.customer_notification_settings FOR SELECT
  USING (get_current_user_role() = 'admin');

CREATE POLICY "customer_notification_settings: admins can insert"
  ON public.customer_notification_settings FOR INSERT
  WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "customer_notification_settings: admins can update"
  ON public.customer_notification_settings FOR UPDATE
  USING (get_current_user_role() = 'admin');

CREATE POLICY "customer_notification_settings: admins can delete"
  ON public.customer_notification_settings FOR DELETE
  USING (get_current_user_role() = 'admin');
```

Application code treats this as a singleton: on write, upsert the first row; on read, `.select('*').limit(1).maybeSingle()`. If no row exists, customer notifications are effectively disabled.

### Migration `017_deliveries_recipient_kind.sql`

```sql
-- Distinguish admin vs. customer deliveries in the audit log.
ALTER TABLE public.notification_deliveries
  ADD COLUMN recipient_kind TEXT NOT NULL DEFAULT 'admin'
    CHECK (recipient_kind IN ('admin', 'customer'));

-- channel_id becomes nullable for customer deliveries (no channel row involved).
-- It's already nullable via ON DELETE SET NULL in migration 012, so no schema change.
```

- Customer delivery dedup key format: `customer:${event_type}:${appointment_id}:${updated_at_iso}`. The `customer:` prefix prevents collision with admin-channel keys (which use `channel_id`). No DB change needed — the application generates the string.

## 4. Dispatch path

### 4a. New module layout

```
lib/notifications/
  index.ts                        -- existing dispatchEvent (admin fan-out) — untouched
  customer-dispatch.ts            -- NEW: dispatchCustomerEvent
  queries.ts                      -- existing; no change
  types.ts                        -- ADD: CustomerNotificationSettings, CustomerDispatchResult
  channels/
    email-resend.ts               -- existing; reused for customer sends
  templates/
    customer/                     -- NEW
      index.ts                    -- CUSTOMER_TEMPLATE_MAP
      customer-appointment-confirmed.ts
      customer-appointment-cancelled.ts
```

### 4b. `dispatchCustomerEvent` — contract

```ts
// lib/notifications/customer-dispatch.ts
export async function dispatchCustomerEvent(
  eventType: NotificationEventType,
  appointment: AppointmentWithDetails,
  updatedAt: string
): Promise<CustomerDispatchResult | null>;
```

Returns `null` when nothing was attempted (disabled, no email, event not subscribed). Returns a `CustomerDispatchResult` (sent or failed) when a send was attempted. Never throws.

Algorithm:

1. Load the singleton `customer_notification_settings` via service-role client. If no row or `is_enabled = false` → return `null`.
2. If `eventType` not in `settings.events` → return `null`.
3. If `appointment.customer?.email` is null/empty → insert a `failed` delivery row with `last_error = 'no_customer_email'` and return that result. (So it's visible in the delivery log — silent drop is worse for debugging.)
4. Build dedup key: `customer:${eventType}:${appointment.id}:${updatedAt}`.
5. Insert `notification_deliveries` row: `{ appointment_id, event_type, channel_id: null, recipient_kind: 'customer', status: 'pending', attempt_count: 0, dedup_key }`. On unique violation (code `23505`) → return `null` (already dispatched; idempotent retry).
6. Render via `CUSTOMER_TEMPLATE_MAP[eventType](appointment)`.
7. Call `sendEmail({ api_key: settings.resend_api_key, from: settings.from_address, to: appointment.customer.email }, message)`.
8. On success: UPDATE the row to `status='sent', sent_at=now()`. Return `{ status: 'sent', ... }`.
9. On error: UPDATE the row to `status='failed', last_error, attempt_count: 1`. Return `{ status: 'failed', error, ... }`. Never rethrow.

### 4c. Webhook route changes — `app/api/notifications/appointment-webhook/route.ts`

After the existing admin `dispatchEvent` loop:

```ts
import { dispatchCustomerEvent } from '@/lib/notifications/customer-dispatch';

const CUSTOMER_EVENT_TYPES: NotificationEventType[] = [
  'appointment.confirmed',
  'appointment.cancelled',
];

// Actor guard: only notify the customer if a non-customer actor made the change.
const updatedBy = payload.record.updated_by as string | null;
const customerId = payload.record.customer_id as string | null;
const actorIsNonCustomer = !!updatedBy && !!customerId && updatedBy !== customerId;

const customerResults: (Awaited<ReturnType<typeof dispatchCustomerEvent>>)[] = [];
if (actorIsNonCustomer) {
  for (const eventType of eventTypes) {
    if (!CUSTOMER_EVENT_TYPES.includes(eventType)) continue;
    const result = await dispatchCustomerEvent(eventType, appointment, updatedAt);
    customerResults.push(result);
  }
}
```

Include `customerResults` in the 200 response for visibility during testing. Webhook still returns 200 on partial failure — the delivery log is the source of truth.

### 4d. Runtime / timeout notes

- Existing route is already `runtime = 'nodejs'`, `maxDuration = 30`. Customer dispatch adds at most one extra HTTP call (Resend). Still well within budget.

## 5. Customer-facing templates

Tone is different from admin templates: warmer, no internal IDs, no "pending" status chatter, short CTA.

### 5a. `customer-appointment-confirmed.ts`

Subject: `Your appointment is confirmed — ${formatDate(date)}`

Plain text body (reference copy — polish acceptable):

```
Hi ${firstName},

Good news — your appointment is confirmed.

Date: ${formatDate(date)}
Time: ${formatTime(start)} – ${formatTime(end)}
Services: ${serviceNames}
Location: ${locationDescription}
Payment: ${paymentMethod} • ${total} MAD

See you soon!

— DesArt Barber Shop
```

HTML: inline-styled, mirrors admin template visual language (green accent `#22c55e`, same table layout as `appointment-confirmed.ts`) but customer-framed copy. No need for `telegramHtml` / `whatsAppCloudParams` — return empty strings / empty arrays. (Do not widen `RenderedMessage`; keeping the shape stable is less churn than introducing a new `EmailMessage` type.)

### 5b. `customer-appointment-cancelled.ts`

Subject: `Your appointment was cancelled — ${formatDate(date)}`

Plain text body:

```
Hi ${firstName},

We're sorry — your appointment on ${formatDate(date)} at ${formatTime(start)} has been cancelled.

If this was unexpected, please contact us. You can also book a new time any time.

Rebook: ${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/book

— DesArt Barber Shop
```

HTML: red-accent (`#ef4444`) card with a "Book a new appointment" button that links to `/book`. Do not hardcode the base URL — read `NEXT_PUBLIC_SITE_URL` (add this env var to the env list in §7) and fall back to an empty string if missing (the link just won't render). The admin should set this in Vercel.

### 5c. Template map

```ts
// lib/notifications/templates/customer/index.ts
export const CUSTOMER_TEMPLATE_MAP: Partial<Record<NotificationEventType, (apt: AppointmentWithDetails) => RenderedMessage>> = {
  'appointment.confirmed': buildCustomerAppointmentConfirmedMessage,
  'appointment.cancelled': buildCustomerAppointmentCancelledMessage,
};
```

`Partial<>` — only the two customer-facing events are populated. `dispatchCustomerEvent` must guard with `if (!CUSTOMER_TEMPLATE_MAP[eventType]) return null;` before rendering.

## 6. Admin UI

Add to `app/admin/components/NotificationsManager.tsx`:

### 6a. New "Customer notifications" card

Fourth card below the existing three channel cards. Contents:

- **Enabled toggle** (`is_enabled`).
- **Resend API key** (password input; masked display when present using existing `maskSecret` from `lib/notifications/types.ts`).
- **From address** (text input; free-form, e.g., `DesArt <no-reply@yourdomain.com>`).
- **Event subscription checklist** — two rows: "Confirmed by admin", "Cancelled by admin". Maps to `settings.events[]`.
- **Send test email** — input for a recipient address + button. Calls `POST /api/notifications/customer-settings/test` with `{ to }`. Renders a hardcoded "This is a test from DesArt" message through the Resend adapter using the saved settings.
- **Save** button (PUT the whole record).

Reuse existing UI primitives (`Modal`, `Badge`, `Toast`, `DataTable`) — do not introduce new ones.

### 6b. Delivery log filter

The existing delivery log table should learn the `recipient_kind` column:
- Add a "Recipient" column (shows `admin` / `customer`).
- Add a filter tab or dropdown: All / Admin / Customer.

### 6c. Server routes

Under `app/api/notifications/`:

- `GET /customer-settings` — returns the singleton row (or `null`). Admin-only.
- `PUT /customer-settings` — upserts the singleton. Admin-only. Validate: `from_address` non-empty, `resend_api_key` looks like `re_...` (length ≥ 10 is fine, don't over-validate), `events[]` subset of `['appointment.confirmed', 'appointment.cancelled']`.
- `POST /customer-settings/test` — body `{ to: string }`. Admin-only. Calls `sendEmail` with a hardcoded test payload and the saved settings. Returns success or the provider error.

Copy the auth pattern from `app/api/professionals/route.ts` L6–L16 verbatim for all three. Strip `resend_api_key` from GET responses (return `has_api_key: boolean` instead) to avoid secret exposure to the browser — follow the pattern established in `lib/notifications/sanitize.ts` (see commit `7a9d4db`).

## 7. Env vars

Add to `.env.local` (document in README, do not commit):

```
# Public site origin — used in customer emails to build the /book rebook link.
NEXT_PUBLIC_SITE_URL=https://desart.example.com
```

No new server-only secrets. Resend credentials live in the DB singleton; the webhook secret and service-role key are already in place from the admin notification system.

## 8. Reliability & edge cases

- **Customer has no email on profile** → inserts `failed` delivery with `last_error = 'no_customer_email'`. Visible in the admin delivery log; silent drop is worse for debugging.
- **Admin flips state repeatedly** (pending → confirmed → cancelled → confirmed) → each genuine transition emails the customer because dedup key includes `updated_at`. Working as intended.
- **Batch UPDATE in SQL console / service-role script** → `auth.uid()` is NULL, trigger leaves `updated_by` as-is. If the row's existing `updated_by` happens to equal `customer_id`, the change won't trigger a customer email. Acceptable — operator-initiated bulk edits should not mass-mail customers.
- **Customer clicks cancel twice quickly** → both UPDATEs get `updated_by = customer_id`, neither sends an email. Correct.
- **Professional role edits a status** (future capability) → treated as non-customer actor, customer gets emailed. Correct by default.
- **Idempotency** — customer dedup key prefix `customer:` prevents collisions with admin channel keys that use `channel_id`.
- **PII in logs** — never log `resend_api_key` or email bodies. Log only `{ event_type, recipient_kind, appointment_id, status, error_class }`.

## 9. Testing

### 9a. Unit

- Customer templates: feed a fixture `AppointmentWithDetails`, snapshot subject + plain text + html. Assert `telegramHtml` and `whatsAppCloudParams` are empty (not populated by accident).
- `dispatchCustomerEvent`: mock `sendEmail` + service-role client. Cases:
  1. Settings disabled → returns `null`, no delivery row inserted.
  2. Event not in `settings.events[]` → returns `null`.
  3. Customer email null → inserts `failed` row with `no_customer_email`.
  4. Happy path → inserts `pending` then updates to `sent`.
  5. Resend throws → updates to `failed` with `last_error`.
  6. Dedup collision (code `23505`) → returns `null`, no error thrown.

### 9b. Integration

- Webhook route with `updated_by != customer_id`: customer dispatch is called.
- Webhook route with `updated_by == customer_id`: customer dispatch is NOT called (assert the mock was not invoked).
- Webhook route with `updated_by` null: customer dispatch is NOT called.
- Webhook route with event type outside `CUSTOMER_EVENT_TYPES` (e.g., `appointment.completed`): customer dispatch is NOT called.

### 9c. Manual acceptance

1. Admin confirms a pending booking → customer receives "confirmed" email within 10s; admin channels also fire.
2. Customer cancels their own booking from the user panel → no customer email fires; admin channels still fire.
3. Admin cancels a booking → customer receives "cancelled" email with working `/book` link; admin channels also fire.
4. Disable customer notifications in admin UI → admin cancels → no customer email, admin channels still fire.
5. Uncheck `appointment.cancelled` in customer settings → admin cancels → only "confirmed" path would email (test by confirming another booking afterwards).
6. Delete the customer's email from their profile → admin cancels → delivery log shows `failed` / `no_customer_email` for the customer row; admin channels still succeed.
7. Re-fire the webhook with the same `updated_at` → no duplicate customer email (dedup).

## 10. Implementation order (do NOT skip ahead — each step its own commit)

1. Migration `015` — `updated_by` column + trigger + backfill. Verify via psql: admin-session UPDATE sets `updated_by` to admin's profile id; customer-session UPDATE sets it to customer's profile id.
2. Migration `016` — `customer_notification_settings` table + RLS. Verify admin can CRUD, customer cannot SELECT.
3. Migration `017` — `recipient_kind` column on `notification_deliveries`.
4. Customer templates (`lib/notifications/templates/customer/*`) + snapshot tests.
5. `dispatchCustomerEvent` in `lib/notifications/customer-dispatch.ts` + unit tests.
6. Webhook route extension — hook in the customer dispatch after admin fan-out + integration test.
7. CRUD routes (`GET`/`PUT`/`POST test`) under `app/api/notifications/customer-settings/`.
8. Admin UI — new card in `NotificationsManager.tsx` + delivery log column/filter.
9. Manual acceptance pass per §9c.
10. Update `README.md`: document `NEXT_PUBLIC_SITE_URL`, add "Customer notifications" to the admin feature list, note that migration 015 adds `updated_by` to appointments.

Do not combine steps. If anything breaks, the next implementer needs to bisect cleanly.
