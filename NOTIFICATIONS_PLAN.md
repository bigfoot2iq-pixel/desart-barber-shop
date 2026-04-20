# Implementation Plan — Admin Appointment Notifications (Email + WhatsApp + Telegram)

> Audience: the AI agent that will implement this. Read every section before touching code. The notes below reflect the *current* repo state as of commit `3f521ef`.

## 0. Context the implementer must know before touching code

- This is Next.js **16.2.4** (App Router). Per `AGENTS.md`, read the relevant guide under `node_modules/next/dist/docs/` before writing any route/server-action code — APIs have drifted from prior versions.
- Stack: Supabase (Postgres + Auth + RLS), Next App Router, React 19. No background worker, no queue, no cron. Hosting target is Vercel.
- Appointments table: `supabase/migrations/002_create_core_tables.sql` L115–L145. Statuses: `pending | confirmed | cancelled | completed`. Status transitions happen from:
  - Customer side: `createAppointment` (insert → `pending`), `cancelAppointment` (→ `cancelled`). Both run in the browser via `lib/queries/appointments.ts` using the user's Supabase session — no server route in between.
  - Admin side: `assignProfessionalToAppointment`, `updateAppointmentStatus` — also browser-side via `app/admin/components/AppointmentsManager.tsx`.
  - Reviews: migration `011_appointment_reviews.sql`, `lib/queries/reviews.ts`.
- **Because mutations originate client-side, we cannot hook notifications by intercepting API routes.** Dispatch MUST be driven by the database, not by the client. Two options exist; §4 picks one and explains why.
- No `.env.example` exists yet. Environment variables in use: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. There is no `SUPABASE_SERVICE_ROLE_KEY` in the repo — we will need to add one for the notification endpoint (so it can bypass RLS when reading `notification_channels`).
- Admin UI lives in `app/admin/` with section enum in `app/admin/components/Sidebar.tsx` (`dashboard | appointments | professionals | services | salons`). We will add a `notifications` section.
- Admin auth check pattern to copy: `app/api/professionals/route.ts` L6–L16 — **`user.app_metadata.role === 'admin'`** is the authoritative check, NOT `profiles.role` (RLS-writable by user; explicitly noted as unsafe there).

## 1. Provider choice — free-tier analysis

Goal: zero ongoing cost, reliable enough for admin-only delivery (low volume — a few dozen notifications per day at peak).

### 1a. Email — pick **Resend**

| Provider | Free tier | Notes |
|---|---|---|
| **Resend** | 3,000/mo, 100/day, 1 domain | Best DX, 5-line SDK, first-class Next.js. Requires DNS verification for custom from-address; `onboarding@resend.dev` works immediately for testing. |
| Brevo (Sendinblue) | 300/day (~9,000/mo) | Higher cap but worse DX, older API style, slower dashboard. Worth mentioning but not worth the ergonomic cost for admin-only volume. |
| SendGrid | 100/day forever | Cold-start reputation issues; Twilio-owned; heavier onboarding. |
| Mailersend | 3,000/mo | Comparable to Resend; Resend's SDK is cleaner for TS. |
| Gmail SMTP (app password) | 500/day | Free but (a) couples to a personal Google account, (b) Google disabled "Less secure apps" — requires 2FA + app password, (c) no unsubscribe/analytics, (d) easy to trip anti-spam if "from" ≠ the Gmail address. Fine as a fallback; not as the default. |

**Decision: Resend.** Admin volume is well under 100/day. One env var (`RESEND_API_KEY`), one `fetch` call. If the admin's own inbox is Gmail, delivery to Gmail is just routing — Resend handles it.

**Note for implementer:** do NOT use the `resend` npm package if it pulls React-email as a hard dep; use the REST API directly via `fetch` to keep the bundle thin. Endpoint: `POST https://api.resend.com/emails`, bearer auth.

### 1b. Telegram — **Telegram Bot API** (100% free, no limits relevant at this scale)

Flow:
1. Admin opens `@BotFather` on Telegram, runs `/newbot`, gets a bot token.
2. Admin starts a chat with the bot (mandatory — bots can only message users who've initiated contact).
3. Admin hits `https://api.telegram.org/bot<TOKEN>/getUpdates` once and copies their `chat.id`.
4. Our server POSTs to `https://api.telegram.org/bot<TOKEN>/sendMessage` with `{ chat_id, text, parse_mode: "HTML" }`.

The admin stores `{ bot_token, chat_id }` in `notification_channels`. No library needed — one `fetch`.

### 1c. WhatsApp — **WhatsApp Cloud API (Meta)** as primary, **CallMeBot** as fallback

| Option | Cost | Pros | Cons |
|---|---|---|---|
| **WhatsApp Cloud API** | 1,000 service conversations/mo free; admin-initiated needs approved **template** | Official, stable | Setup is bureaucratic: Meta Business account, app, phone number verification, template approval (~24h). Message templates required for business-initiated messages outside a 24h user-initiated window. |
| **CallMeBot** | Free, unlimited to your own phone | 3-minute setup: admin messages `+34 644 93 89 49` with `"I allow callmebot to send me messages"`, gets an API key back, we `GET https://api.callmebot.com/whatsapp.php?phone=<>&text=<>&apikey=<>` | Unofficial, no SLA, could vanish. Only sends to pre-authorized numbers. |
| Twilio WhatsApp | Trial credit only | N/A | Not free long-term. |
| `whatsapp-web.js` (browser automation) | Free | — | Requires persistent browser session; breaks with WA updates; ToS-grey. **Reject.** |

**Decision:** ship **CallMeBot first** (it unblocks the admin on day one), then implement **WhatsApp Cloud API** as a second adapter the admin can opt into once their Meta account is approved. Both are encapsulated behind the same `WhatsAppAdapter` interface — the provider is a field in the config row.

## 2. Database schema — new migration `012_notification_channels.sql`

Two tables. Keep them minimal — this is admin-only config, not a multi-tenant product.

```sql
-- 1. Per-channel config rows. One row per (admin_user, channel_kind, provider).
CREATE TABLE public.notification_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'telegram')),
  provider TEXT NOT NULL, -- 'resend' | 'whatsapp_cloud' | 'callmebot' | 'telegram_bot'
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  -- Encrypted at rest via pgsodium OR stored in env; see §3.
  config JSONB NOT NULL, -- shape depends on provider, see below
  -- Per-event subscription: which events should this channel receive.
  events TEXT[] NOT NULL DEFAULT ARRAY[
    'appointment.created',
    'appointment.cancelled',
    'appointment.confirmed',
    'appointment.completed'
  ],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notification_channels_admin ON public.notification_channels(admin_id);
CREATE INDEX idx_notification_channels_enabled ON public.notification_channels(is_enabled) WHERE is_enabled = true;

-- 2. Delivery log (for audit + retry + idempotency).
CREATE TABLE public.notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  channel_id UUID REFERENCES public.notification_channels(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  attempt_count INT NOT NULL DEFAULT 0,
  last_error TEXT,
  -- Dedup key: event_type + appointment_id + channel_id. Prevents double-sends
  -- when a webhook fires twice (Supabase retries on non-2xx).
  dedup_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  UNIQUE (dedup_key)
);

CREATE INDEX idx_notification_deliveries_appointment ON public.notification_deliveries(appointment_id);
CREATE INDEX idx_notification_deliveries_status ON public.notification_deliveries(status);

-- RLS: only admin (app_metadata.role = 'admin') can SELECT/INSERT/UPDATE/DELETE.
ALTER TABLE public.notification_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

-- Copy the admin-only policy pattern from migration 003/005 (use whatever helper
-- function those files define; do NOT reference profiles.role — use JWT claim
-- app_metadata.role per migration 008_security_fixes.sql).
```

**`config` JSONB shape per provider:**

```jsonc
// provider = 'resend'
{ "api_key": "re_...", "from": "notifications@yourdomain.com", "to": "admin@example.com" }

// provider = 'telegram_bot'
{ "bot_token": "123:ABC...", "chat_id": "123456789" }

// provider = 'callmebot'
{ "phone": "+212600000000", "api_key": "1234567" }

// provider = 'whatsapp_cloud'
{ "access_token": "EAAG...", "phone_number_id": "123...", "to": "212600000000",
  "template_name": "appointment_alert", "template_lang": "en" }
```

**Secret handling:** the cleanest options, in order of preference:
1. Store secrets ONLY in Vercel env vars, and `config` holds just the *reference* (e.g., `{"key_env":"RESEND_API_KEY"}`). Downside: admin can't self-serve; dev must redeploy. **Reject — defeats the point of the admin UI.**
2. Store secrets in `config` JSONB, encrypt with `pgsodium` symmetric encryption at the DB layer. Master key in Supabase vault.
3. Store plaintext in `config`, rely on RLS (admin-only SELECT). **Acceptable for MVP** given solo-admin context, but add a `TODO: encrypt with pgsodium` comment in the migration. Never log `config` values.

Pick option 3 for the MVP; leave a migration stub `013_encrypt_notification_channels.sql` as a placeholder.

## 3. Dispatch architecture — how an appointment change becomes three messages

### The decision: Supabase **Database Webhooks** → Next.js route → fan-out

- **Why not call a server action from client code?** Multiple call sites (customer cancel, admin confirm, admin assign, future customer reschedule) — easy to forget one. A DB-level hook is the only place that catches every mutation.
- **Why not a Postgres trigger + `pg_net`?** Equivalent in outcome. Webhooks are configured in the Supabase dashboard (friendlier to debug), have built-in retry on non-2xx, and don't require `pg_net` extension setup. Pick webhooks.

### 3a. Webhook configuration (document in the migration comment + README)

In Supabase dashboard → Database → Webhooks, create one webhook:

- Name: `appointments_notify`
- Table: `appointments`
- Events: `INSERT`, `UPDATE`
- Type: HTTP Request
- Method: `POST`
- URL: `https://<your-domain>/api/notifications/appointment-webhook`
- HTTP Headers: `x-webhook-secret: <random>` (match `NOTIFICATIONS_WEBHOOK_SECRET` env var)

### 3b. The route: `app/api/notifications/appointment-webhook/route.ts`

Responsibilities:

1. Validate `x-webhook-secret` header against env. Reject 401 otherwise. **Do NOT rely on Supabase auth here — the webhook is server-to-server, not user-authenticated.**
2. Parse Supabase webhook payload: `{ type: 'INSERT'|'UPDATE'|'DELETE', record, old_record, table, schema }`.
3. Derive the event type:
   - `INSERT` + `record.status === 'pending'` → `appointment.created`
   - `UPDATE` + `old_record.status !== record.status`:
     - `'pending' → 'confirmed'` → `appointment.confirmed`
     - `* → 'cancelled'` → `appointment.cancelled`
     - `* → 'completed'` → `appointment.completed`
   - `UPDATE` + `old_record.professional_id !== record.professional_id` → `appointment.professional_assigned`
   - Everything else → ignore (return 200 so Supabase doesn't retry).
4. Use a **service-role** Supabase client (add `SUPABASE_SERVICE_ROLE_KEY` env var; build a new helper `lib/supabase/service.ts` that uses it — do NOT reuse `lib/supabase/server.ts`, which is cookie-scoped).
5. Load the full appointment via `getAppointmentWithDetails(record.id)` so we have customer name, service names, salon name, etc., for the message body.
6. Load all enabled `notification_channels` whose `events @> ARRAY[<event_type>]`.
7. For each channel, insert a `notification_deliveries` row with `status='pending'` and the dedup key `${event_type}:${appointment_id}:${channel_id}`. If unique violation → already dispatched, skip (idempotency).
8. Fan out: call each channel adapter (§4) with `Promise.allSettled`. Update each delivery row to `sent` or `failed` with `last_error`. **Do not throw on channel errors** — one broken channel must not block the others.
9. Return `200 { ok: true, dispatched: N }`.

**Return 200 even on partial failure.** The `notification_deliveries` table is the source of truth for retry; we don't want Supabase to re-fire the whole webhook just because Telegram was down.

### 3c. Runtime / timeout notes

- Vercel serverless default timeout is 10s on Hobby, 60s on Pro. Three HTTP calls to providers should comfortably fit. Mark this route `export const runtime = 'nodejs';` (some providers' SDKs or our `fetch` with keep-alive want Node, not Edge). Explicit `export const maxDuration = 30;`.
- Do NOT stream or use `waitUntil` for the dispatches — the webhook caller (Supabase) waits for the response, and we've already committed to returning 200 only after attempts complete. This keeps the delivery log consistent.

## 4. The notification module — `lib/notifications/`

```
lib/notifications/
  index.ts                  -- dispatchEvent(eventType, appointment) — the public entry
  channels/
    email-resend.ts         -- sendEmail(config, subject, htmlBody, textBody)
    telegram-bot.ts         -- sendTelegram(config, text)
    whatsapp-callmebot.ts   -- sendWhatsAppCallMeBot(config, text)
    whatsapp-cloud.ts       -- sendWhatsAppCloud(config, templateParams)
  templates/
    appointment-created.ts  -- buildSubject/Body from AppointmentWithDetails
    appointment-confirmed.ts
    appointment-cancelled.ts
    appointment-completed.ts
    appointment-assigned.ts
  types.ts                  -- NotificationEvent, ChannelConfig union, DispatchResult
```

### 4a. Adapter contract

```ts
export interface ChannelAdapter<C> {
  send(config: C, payload: RenderedMessage): Promise<void>; // throws on provider error
}

export interface RenderedMessage {
  subject: string;       // used by email only
  plainText: string;     // used by SMS-like channels (WhatsApp, Telegram fallback)
  html: string;          // used by email
  telegramHtml: string;  // Telegram supports a restricted HTML subset — render separately
}
```

Each adapter does ONE `fetch` call. No retries inside the adapter — retry is a §6 concern.

### 4b. Message templates — tone

Keep it short. Admin reads these on a phone. Example `appointment.created` plainText:

```
🆕 New booking — pending
Ali Ben ( +212 6 12 34 56 78 )
Sat 25 Apr • 15:00–15:45
Services: Classic haircut, Beard trim
Location: Salon Downtown
Payment: Cash • 180 MAD
```

Email HTML can be richer but **do not depend on an email-template library** — write inline-styled HTML strings. Keep dependencies out.

### 4c. Telegram HTML subset

Telegram's `parse_mode: "HTML"` allows only `<b>`, `<i>`, `<u>`, `<s>`, `<code>`, `<pre>`, `<a href>`. Do not send full email HTML. Build a separate `telegramHtml` in the template.

## 5. Admin UI — `app/admin/components/NotificationsManager.tsx`

- Add `'notifications'` to the `Section` union in `app/admin/components/Sidebar.tsx` with an icon (use Lucide `bell`).
- Wire the route in `AdminDashboard.tsx` (follow the existing pattern for `AppointmentsManager`).
- Page content:
  1. **Three cards**, one per channel (Email / WhatsApp / Telegram). Each card shows current status (enabled/disabled, provider, masked credential), a toggle, and an "Edit" button that opens a modal with provider-specific form fields.
  2. **Event subscription checklist** inside each card — `appointment.created`, `appointment.confirmed`, `appointment.cancelled`, `appointment.completed`, `appointment.professional_assigned`. Defaults: all checked.
  3. **"Send test"** button per card. Calls `POST /api/notifications/test` with `{ channel_id }`; backend sends a hardcoded "This is a test from DesArt" message. Shows a toast with success/failure and the provider error if any.
  4. **Delivery log** at the bottom — last 50 rows from `notification_deliveries` joined to `notification_channels`, showing event, channel, status, timestamp, error. Read-only. Helps debug.

- Reuse existing admin UI primitives: `app/admin/components/ui/Modal.tsx`, `Badge.tsx`, `Toast.tsx`, `DataTable.tsx`. Do not introduce new ones.
- Auth gating: the entire `/admin` subtree already redirects non-admins (see `app/admin/page.tsx` L16–L19). No additional client check needed inside this component.

### 5a. Server routes for the admin UI

All under `app/api/notifications/`:

- `POST /channels` — create (admin only; copy the auth check from `app/api/professionals/route.ts` L6–L16 verbatim).
- `PATCH /channels/[id]` — update.
- `DELETE /channels/[id]` — delete.
- `POST /test` — body `{ channel_id }`, sends a test message through that channel's adapter.
- `GET /deliveries` — read the last 50 delivery rows (admin only).

Validate provider-specific `config` shapes on write — reject if required fields missing, so we fail fast instead of at send-time.

## 6. Reliability concerns (keep scope tight — do NOT build a full queue)

- **Idempotency:** unique index on `notification_deliveries.dedup_key` (§2) prevents double-sends if Supabase retries the webhook on transient errors.
- **Retry for failed sends:** out of scope for MVP. Add a "Retry" button per failed row in the delivery log that re-invokes the adapter. Document in §7 future work: a Vercel Cron that retries `status='failed' AND attempt_count < 3`.
- **Rate limits:** Resend free is 100/day. At admin volume we will not hit this. Add a guard anyway in the Resend adapter that short-circuits with `last_error='rate_limited'` if the response is 429 — don't retry inside the adapter.
- **PII in logs:** never log `config` contents. Never log full message bodies. Log only `{ event_type, channel, appointment_id, status, error_class }`.

## 7. Env vars to add

Add to `.env.local` (document, do not commit):

```
# Per-request webhook auth from Supabase → Next
NOTIFICATIONS_WEBHOOK_SECRET=<generate: openssl rand -hex 32>

# Service-role key so the webhook can read notification_channels bypassing RLS.
# This is the ONLY code path that uses service role. Keep it server-only.
SUPABASE_SERVICE_ROLE_KEY=<from Supabase dashboard>
```

Provider secrets (`RESEND_API_KEY`, etc.) are NOT env vars — they live in `notification_channels.config` because the admin self-configures them.

## 8. Testing

- Unit: templates render the expected strings for each event type. Feed a fixture `AppointmentWithDetails` through each template; snapshot.
- Integration: the webhook route, given a synthetic Supabase payload, writes the right number of `notification_deliveries` rows and calls the correct adapters. Mock `fetch` globally.
- Manual acceptance checklist (end of implementation):
  1. Book an appointment as a customer → admin's email/WhatsApp/Telegram all receive "new booking" within 10s.
  2. Admin confirms it → admin receives "confirmed".
  3. Customer cancels → admin receives "cancelled".
  4. Disable Telegram channel → book another → email + WhatsApp fire, Telegram does not.
  5. Set bad Telegram token → book → delivery log shows `failed` with `Unauthorized` error; other two still succeed.
  6. Manually re-fire the webhook with the same payload → no duplicate delivery (dedup).

## 9. Implementation order (do NOT skip ahead)

1. Migration `012` + local apply; add RLS policies; verify admin can SELECT/INSERT via psql.
2. `lib/supabase/service.ts` (service-role client, server-only) + env var.
3. `lib/notifications/` module: types, one adapter at a time (Telegram first — easiest to test), templates for `appointment.created` only.
4. Webhook route `/api/notifications/appointment-webhook` — handle `appointment.created` only. Configure the webhook in Supabase. Book a real appointment. Confirm Telegram fires.
5. Add remaining event types + templates.
6. Add Email (Resend) adapter. Test DNS/sender.
7. Add CallMeBot adapter. Test with the admin's phone.
8. Admin UI: `NotificationsManager` + CRUD routes + test-send + delivery log.
9. Add WhatsApp Cloud adapter (last — most setup).
10. Merge. Document webhook URL + secret rotation in README.

Do not combine steps. Each step above should be its own commit; if anything breaks, the next implementer needs to bisect cleanly.
