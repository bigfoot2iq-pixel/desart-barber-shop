# Implementation Plan — Payment Method Selection on Booking

> Audience: the AI agent that will implement this. Read every section before touching code. Current repo state as of branch `master`, after migration `017_deliveries_recipient_kind.sql`.

## 0. Context the implementer must know before touching code

- This is Next.js **16.2.4** (App Router). Per `AGENTS.md`, read the relevant guide under `node_modules/next/dist/docs/` before writing any route/server-action code — APIs have drifted from prior versions.
- There is **no i18n layer**. Strings are hard-coded JSX in English; don't introduce `next-intl` for this feature.
- There is **no form library** (no react-hook-form, no Zod). Local `useState` + manual validation is the established pattern; copy it.
- The booking flow is a 6-step modal in `app/page.tsx` (a single ~2000-line file). Do not extract it into a new component tree as part of this change — scope is the details step only.
- `PaymentMethod = 'cash' | 'bank_transfer'` already exists in `lib/types/database.ts:3` and the DB check constraint on `appointments.payment_method` already allows both (migration `002_create_core_tables.sql:128`). **No schema change is needed on `appointments`.**
- Currently the client hard-codes `payment_method: "cash"` at `app/page.tsx:723`. The rest of the plumbing through `createAppointment()` (`lib/queries/appointments.ts:211`) already forwards the field — no query-layer change needed.
- Admin auth pattern for any admin-only API route: `app/api/professionals/route.ts` L6–L16. The authoritative check is **`user.app_metadata.role === 'admin'`** — NOT `profiles.role` (that column is RLS-writable, per migration `008_security_fixes.sql`).
- Admin UI lives under `app/admin/` with a `Sidebar.tsx` + section components in `app/admin/components/`. Add new admin surfaces there; do not invent a new layout.

## 1. Scope

Replace the hard-coded "cash only" notice on the **Your Details** step (step 5) with a user-selectable payment method. Two methods for MVP:

| Method | Stored as | Behavior |
|---|---|---|
| Cash at appointment | `'cash'` | Current behavior: booking saved `pending`, no extra info shown. Default. |
| Bank transfer | `'bank_transfer'` | Booking still saved `pending`; UI surfaces the admin's bank details (RIB, bank name, account holder), plus instructions to send proof of payment to the shop's WhatsApp number. |

**Out of scope (do NOT build):**
- Online card payments (Stripe/CMI/etc.)
- Proof-of-payment upload inside the booking modal
- Automatic payment verification or status-change workflow
- Per-salon bank accounts (the shop has one global account)
- Encrypting bank details at rest (same MVP stance as `notification_channels`)

## 2. Data model — where admin bank details live

A new singleton-style settings table. Do **not** add columns to `salons` (the RIB is global, not per-location) and do **not** reuse `notification_channels` (that is per-event dispatch config, wrong audience).

### Migration `018_payment_settings.sql`

```sql
-- Shop-wide payment configuration. Singleton: one active row at a time.
-- Read by anonymous users during the booking flow, writable by admin only.

CREATE TABLE public.payment_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_transfer_enabled BOOLEAN NOT NULL DEFAULT false,
  account_holder TEXT,
  bank_name TEXT,
  rib TEXT,                 -- Moroccan 24-digit RIB, stored as display string
  iban TEXT,                -- optional, for international transfers
  swift_bic TEXT,           -- optional
  payment_phone TEXT,       -- WhatsApp number for sending proof-of-payment
  instructions TEXT,        -- free-text instructions shown under the details
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Enforce singleton: only one row may exist.
  singleton BOOLEAN NOT NULL DEFAULT true UNIQUE CHECK (singleton = true)
);

-- Enforce that when bank_transfer is enabled, the minimum fields are present.
-- Cash is always available; the switch only governs whether bank_transfer is shown.
ALTER TABLE public.payment_settings ADD CONSTRAINT bank_transfer_requires_details
  CHECK (
    bank_transfer_enabled = false
    OR (rib IS NOT NULL AND account_holder IS NOT NULL AND bank_name IS NOT NULL)
  );

-- Seed empty row so `.single()` reads don't 404 on a fresh deploy.
INSERT INTO public.payment_settings (singleton) VALUES (true);

-- Maintain updated_at on write.
CREATE TRIGGER payment_settings_set_updated_at
  BEFORE UPDATE ON public.payment_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: anyone can SELECT (the booking flow runs as anon before Google sign-in),
-- only admins can INSERT/UPDATE/DELETE.
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY payment_settings_public_read ON public.payment_settings
  FOR SELECT
  USING (true);

CREATE POLICY payment_settings_admin_write ON public.payment_settings
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
```

**Notes:**
- The `singleton` column + UNIQUE + CHECK is the idiomatic "only one row" pattern in Postgres.
- `set_updated_at()` already exists (migration `004_triggers_and_helpers.sql`). Confirm before using.
- RLS reads from `auth.jwt()->app_metadata->role`, not `profiles.role`, per the security guardrail.
- TODO comment in the migration: `-- TODO: encrypt rib/iban with pgsodium if this app ever holds real customer funds`.

### Type addition — `lib/types/database.ts`

```ts
export interface PaymentSettings {
  id: string;
  bank_transfer_enabled: boolean;
  account_holder: string | null;
  bank_name: string | null;
  rib: string | null;
  iban: string | null;
  swift_bic: string | null;
  payment_phone: string | null;
  instructions: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}
```

## 3. Data-access helpers — `lib/queries/payment-settings.ts` (new file)

Two functions. Both use the cookie-scoped client (`lib/supabase/client.ts`). Do **not** use the service-role client — the public read is enforced at RLS.

```ts
export async function getPublicPaymentSettings(): Promise<{
  bank_transfer_enabled: boolean;
  account_holder: string | null;
  bank_name: string | null;
  rib: string | null;
  iban: string | null;
  swift_bic: string | null;
  payment_phone: string | null;
  instructions: string | null;
}>;

export async function updatePaymentSettings(
  patch: Partial<Omit<PaymentSettings, 'id' | 'created_at' | 'updated_at' | 'updated_by'>>
): Promise<PaymentSettings>;
```

- `getPublicPaymentSettings` selects only the columns the booking UI needs — do not return `updated_by` or `id` to the public surface even though RLS allows it. Principle of least disclosure.
- `updatePaymentSettings` is admin-only (RLS enforces); surface friendly error on 42501 / PGRST errors.

## 4. Booking UI — `app/page.tsx` changes

### 4.1 State

Add near the other step-5 state (search for `const [phone, setPhone]`):

```ts
const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
const [paymentSettings, setPaymentSettings] = useState<Awaited<
  ReturnType<typeof getPublicPaymentSettings>
> | null>(null);
```

Fetch `paymentSettings` once when the booking modal opens (reuse whatever `useEffect` opens/seeds the modal; do not fetch on every render). If the fetch fails or `bank_transfer_enabled === false`, treat the picker as cash-only and hide the bank-transfer tile — do **not** break the booking flow.

### 4.2 `persistAppointment` — replace the hard-coded `'cash'`

At `app/page.tsx:723`, change `payment_method: "cash"` to `payment_method: draft.paymentMethod`. Add `paymentMethod` to the draft type (`buildDraft()`) and propagate.

### 4.3 Validation

In `advanceStep` (around `app/page.tsx:749`), after the phone regex check, add:

```ts
if (paymentMethod === "bank_transfer" && !paymentSettings?.bank_transfer_enabled) {
  setToast({ kind: "error", text: "Bank transfer isn't available right now. Please choose cash." });
  return;
}
```

This is a defense-in-depth check — if the admin disables bank transfer while the user had it selected, we don't silently override.

### 4.4 UI — replace the "Cash only" banner at `app/page.tsx:1873–1879`

Insert a payment picker block **between** the phone input group (line 1870, closing `</div>`) and the existing order-summary card (line 1881). Match the existing visual style (Tailwind classes from neighboring labels/cards — gold accent, rounded-xl, `text-[10px] font-semibold tracking-[0.14em] uppercase` section header).

Structure:

```
PAYMENT METHOD (section header)
┌──────────────────┐  ┌──────────────────┐
│ ○ Cash           │  │ ○ Bank transfer  │   ← two radio-styled tiles
│ Pay at your appt │  │ Pay in advance   │      second tile hidden if
└──────────────────┘  └──────────────────┘      bank_transfer_enabled=false

[if bank_transfer selected:]
┌────────────────────────────────────────┐
│ Account holder:  {account_holder}      │
│ Bank:            {bank_name}           │
│ RIB:             {rib}       [Copy]    │
│ IBAN:            {iban}      [Copy]    │  ← only if present
│ Reference:       {first_name} {last_name}
│                                        │
│ After you transfer, send the receipt   │
│ to WhatsApp {payment_phone}.           │
│ Your booking stays pending until we    │
│ confirm the payment.                   │
│ {instructions}                         │  ← only if present
└────────────────────────────────────────┘

[if cash selected, or bank_transfer disabled:]
(the existing "Cash only — pay at your appointment" info banner, but
phrased as "Pay {total} MAD in cash at your appointment.
Cancellations are free; let us know in advance.")
```

Implementation notes for the picker:
- Use `<button type="button" role="radio" aria-checked>` tiles, not `<input type="radio">` — matches the existing booking-step aesthetic (see the location/barber tiles for style reference).
- Focus ring: `focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold`.
- Selected tile: gold border + subtle gold-tinted bg (see the service cards for a concrete example).
- Copy button: use `navigator.clipboard.writeText`. On success show a transient "Copied" pill inside the row for ~1.5s. Fallback silently if clipboard API is unavailable — don't surface an error.
- When the user toggles to bank transfer, `scrollIntoView({ block: 'nearest' })` the newly-expanded details so a phone user sees them without scrolling. Use `layout` animation via Framer Motion only if you're already importing it — don't add new deps.
- Remove the `mb-4` on the old info banner and reuse the same bottom-margin on whichever block becomes the last one.

### 4.5 Confirmation screen (step 6)

If `paymentMethod === 'bank_transfer'`, add a one-line reminder near the existing success state (around `app/page.tsx:1942`): "Don't forget to send your transfer receipt to {payment_phone}." Otherwise leave the success screen alone.

## 5. Admin UI — new settings page

### 5.1 Sidebar entry

Add an item to `app/admin/components/Sidebar.tsx` titled "Payment". Route: `/admin/payment`.

### 5.2 Page — `app/admin/payment/page.tsx` (new)

Server component that checks `user.app_metadata.role === 'admin'` (copy the pattern from `app/admin/page.tsx`), passes initial `PaymentSettings` row to a client component.

### 5.3 Client component — `app/admin/components/PaymentSettingsManager.tsx` (new)

- Toggle: "Accept bank transfers" (`bank_transfer_enabled`).
- Text inputs: account_holder, bank_name, rib, iban (optional), swift_bic (optional), payment_phone, instructions (textarea).
- RIB input: `inputMode="numeric"`, display-only format hint "24 digits". Don't strip spaces on save — store exactly what the admin typed so it matches their bank's display.
- Save button: calls `updatePaymentSettings`. Disable while submitting. Use the existing `Toast` from `app/admin/components/ui/Toast.tsx` for success/error.
- **Client-side guard:** if the toggle is ON but rib/account_holder/bank_name are empty, disable the Save button and show "Fill required fields to enable bank transfers." — the DB constraint will reject anyway, but surface it earlier for UX.

## 6. Tests

### 6.1 Unit / integration (Vitest, `__tests__/`)

- `__tests__/booking/payment-method.test.ts` (new):
  - Persisting `payment_method: 'bank_transfer'` round-trips (write then read).
  - `payment_settings.bank_transfer_enabled=false` + attempt to update with missing RIB rejects at DB layer (`23514` check violation).
- Update existing `__tests__/booking/*` fixtures that assume `payment_method === 'cash'` — most tests should be updated to assert the field is *either* value rather than hard-coding cash.

### 6.2 E2E (Playwright, `__tests__/e2e/`)

Extend `booking-details-step.spec.ts` (referenced in the booking test plan):
- **Default path:** cash is pre-selected; existing flow still passes.
- **Bank transfer path:** seed `payment_settings` with `bank_transfer_enabled=true` and a RIB; click the bank tile; assert RIB is visible and Copy button writes to clipboard; complete the booking; assert the row in `appointments` has `payment_method='bank_transfer'`.
- **Disabled path:** seed `bank_transfer_enabled=false`; assert only the cash tile renders and the booking still completes.

### 6.3 Manual QA checklist

Per `AGENTS.md`, UI changes require browser verification. Before reporting done, start the dev server, open the booking modal in a real browser, and confirm:
- Cash tile is selected by default.
- Toggling to bank transfer reveals the details; Copy works; toggling back hides them.
- Mobile viewport (375px): the two tiles stack correctly and the details card doesn't overflow.
- If the admin has bank transfer disabled, the second tile is hidden and the page still works.
- Step 6 confirmation shows the payment-phone reminder only for bank transfer.
- Type check and tests pass.

## 7. Rollout order (for the implementer)

Do these in order — each step leaves the tree green:

1. Write migration `018_payment_settings.sql`; apply locally; verify the seed row exists and RLS behaves (admin can UPDATE, anon can SELECT, anon cannot UPDATE).
2. Add `PaymentSettings` type + `lib/queries/payment-settings.ts`. No UI yet.
3. Build the admin settings page + sidebar entry. Manually save some values through it.
4. Wire the booking UI: state → fetch → picker → submit. Default to cash; bank-transfer tile behind the feature flag from DB.
5. Update tests. Add E2E.
6. Manual QA.
7. Commit in small logical chunks — one per the steps above — not a single mega-commit. Matches the repo's commit cadence (see `git log`).

## 8. Non-goals / reminders

- Do not introduce a global state manager, a form library, or an i18n layer for this feature.
- Do not change the existing `createAppointment` signature beyond honoring whatever `payment_method` the caller passes.
- Do not add a new webhook event for "payment pending" — the existing `appointment.created` notification to admins already fires on insert; admins will see `payment_method='bank_transfer'` in the row and can cross-reference the WhatsApp receipt manually. A future iteration can add a dedicated notification.
- Do not store or display the admin's bank details server-side-rendered before auth — the booking modal renders client-side and fetches settings after mount; keep it that way to avoid leaking the RIB onto the homepage HTML for search engines.
