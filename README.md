# DesArt Barber Shop

A full-stack barber shop booking platform built with Next.js 16.2.4, Supabase, and React 19.

## Getting Started

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Required Environment Variables

Add these to `.env.local` (never commit this file):

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Notifications webhook secret (generate with: openssl rand -hex 32)
NOTIFICATIONS_WEBHOOK_SECRET=generate-a-random-hex-string

# Optional: home visit surcharge
NEXT_PUBLIC_HOME_VISIT_SURCHARGE_MAD=30

# Public site origin — used in customer emails to build the /book rebook link
NEXT_PUBLIC_SITE_URL=https://desart.example.com
```

## Admin Appointment Notifications

The system sends notifications to admins via **Email (Resend)**, **WhatsApp (CallMeBot or WhatsApp Cloud)**, and **Telegram Bot** whenever an appointment is created, confirmed, cancelled, completed, or has a professional assigned.

### Architecture

1. Appointment changes happen in the database (client-side via Supabase JS).
2. A **Supabase Database Webhook** fires on `INSERT`/`UPDATE` of the `appointments` table.
3. The webhook calls `/api/notifications/appointment-webhook` on your Next.js app.
4. The route validates the secret, derives the event type, loads the appointment details, finds enabled notification channels, and fans out messages.
5. Each delivery is logged in `notification_deliveries` with a dedup key for idempotency.

### Supabase Webhook Configuration

1. Go to **Supabase Dashboard → Database → Webhooks**
2. Click **Create Webhook**
3. Fill in:
   - **Name:** `appointments_notify`
   - **Table:** `public.appointments`
   - **Events:** `INSERT`, `UPDATE`
   - **Type:** HTTP Request
   - **Method:** `POST`
   - **URL:** `https://<your-domain>/api/notifications/appointment-webhook`
   - **HTTP Headers:** Add a header `x-webhook-secret` with the same value as your `NOTIFICATIONS_WEBHOOK_SECRET` env var

### Setting Up Each Channel (Admin UI)

Navigate to **Admin → Notifications** in the sidebar.

#### Email (Resend)

1. Click **Set up Email** on the Email card.
2. Get an API key from [resend.com](https://resend.com) → API Keys → Create.
3. Fill in the form:
   - **API Key:** `re_...`
   - **From:** `onboarding@resend.dev` (works immediately, no DNS needed) or your verified domain address
   - **To:** your admin email address
4. Check which events you want to receive.
5. Click **Save**, then **Send Test** to verify.

> To use a custom domain (e.g. `notifications@desart.ma`), verify it in the Resend dashboard first by adding the DNS records they provide.

#### WhatsApp (CallMeBot — Quick Setup)

1. On WhatsApp, send this exact message to `+34 644 93 89 49`:
   ```
   I allow callmebot to send me messages
   ```
2. CallMeBot will reply with an API key.
3. In the admin UI, click **Set up WhatsApp**, select **CallMeBot** as provider.
4. Fill in your phone number (with country code, e.g. `+212600000000`) and the API key.
5. Click **Save**, then **Send Test**.

#### WhatsApp (WhatsApp Cloud API — Meta)

1. Create a Meta Developer app at [developers.facebook.com](https://developers.facebook.com) and add the WhatsApp product.
2. Get your **Phone Number ID** and **Access Token** from the app dashboard.
3. Create an approved message template (e.g. `appointment_alert`).
4. In the admin UI, click **Set up WhatsApp**, select **WhatsApp Cloud API** as provider.
5. Fill in: Access Token, Phone Number ID, recipient phone, template name, and template language.
6. Click **Save**, then **Send Test**.

#### Telegram Bot

1. Open `@BotFather` on Telegram, run `/newbot`, follow prompts, and copy the bot token.
2. Search for your bot by username and send it a `/start` message (required — bots can only message users who initiated contact).
3. Visit `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates` and find your `chat.id` in the JSON response.
4. In the admin UI, click **Set up Telegram**.
5. Fill in the Bot Token and Chat ID.
6. Click **Save**, then **Send Test**.

### Delivery Log & Retry

The bottom of the Notifications page shows the last 50 delivery attempts with:
- Event type, channel, status (sent/failed/pending), timestamp, and error message.
- A **Retry** button on failed rows that re-sends the original message.

### Database Schema

- `notification_channels` — per-admin, per-channel config (provider, credentials, event subscriptions).
- `notification_deliveries` — audit log with dedup key for idempotency.
- Secrets are stored plaintext in `config` (JSONB) for MVP. RLS restricts access to admins only.
- **TODO:** Encrypt with `pgsodium` symmetric encryption before production.

### Secret Rotation

To rotate the webhook secret:
1. Generate a new one: `openssl rand -hex 32`
2. Update `NOTIFICATIONS_WEBHOOK_SECRET` in your `.env.local` / Vercel env vars.
3. Update the `x-webhook-secret` header in the Supabase webhook config.

## Customer Notifications

When an admin (or any non-customer actor) confirms or cancels an appointment, the customer receives an email notification. Customer self-cancels do **not** trigger an email to the customer.

### Architecture

The same Supabase webhook that fires admin notifications also dispatches customer emails. The `updated_by` column on `appointments` (added by migration 015) tracks who last modified the row. Customer dispatch only fires when `updated_by != customer_id`.

### Setting Up Customer Notifications (Admin UI)

Navigate to **Admin → Notifications** in the sidebar. The **Customer notifications** card is below the three channel cards.

1. Click **Enable** to turn on customer notifications.
2. Enter your **Resend API Key** (or leave blank to keep the existing one).
3. Set the **From address** (e.g. `DesArt <no-reply@yourdomain.com>`).
4. Select which events should trigger customer emails:
   - **Confirmed by admin** — sent when an admin confirms a pending booking
   - **Cancelled by admin** — sent when an admin cancels a booking
5. Use **Send test email** to verify the configuration.
6. Click **Save**.

### Database Schema

- `customer_notification_settings` — singleton table holding the Resend API key, from address, and event subscriptions.
- `appointments.updated_by` — tracks the last actor who modified an appointment row.
- `notification_deliveries.recipient_kind` — distinguishes `admin` vs `customer` deliveries in the audit log.

### Delivery Log Filter

The delivery log at the bottom of the Notifications page now includes:
- A **Recipient** column showing `admin` or `customer` badges.
- Filter tabs: **All / Admin / Customer** to narrow the view.
