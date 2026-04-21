# Implementation Plan — Multiple Bank Accounts for Payment Method Selection

> Audience: the AI agent that will implement this. Read every section before touching code. This **extends** `PAYMENT_METHOD_SELECTION_PLAN.md` (already shipped as migrations `018` + the booking picker). Do not restart from scratch — you are migrating a working singleton into a one-to-many relationship.

## 0. Context the implementer must know before touching code

- This is Next.js **16.2.4** (App Router). Per `AGENTS.md`, read the relevant guide under `node_modules/next/dist/docs/` before writing any server action / route handler code.
- There is **no i18n layer** and **no form library** — match the established `useState` + manual-validation pattern.
- `payment_settings` is a **singleton** table created by migration `018`. It currently owns both the global toggle *and* the per-account columns (`account_holder`, `bank_name`, `rib`, `iban`, `swift_bic`). Your job is to extract the per-account columns into a new one-to-many table and narrow `payment_settings` to the truly global fields.
- The booking picker already lives at `app/page.tsx` steps 5 + 6 and reads `getPublicPaymentSettings()` from `lib/queries/payment-settings.ts`. Refactor these — do **not** duplicate them.
- Admin auth check is always `user.app_metadata.role === 'admin'` — never `profiles.role`. RLS patterns must mirror migration `018`.
- `update_updated_at()` (not `set_updated_at()`) is the actual trigger function name in the repo — see migration `004_triggers_and_helpers.sql:33`.
- Visual reference for the admin CRUD you're building: `app/admin/components/ServicesManager.tsx` (list + Modal add/edit + delete, with `Toast` feedback). Copy its structure; do **not** invent a new admin component pattern.

## 1. Scope

Replace the single fixed bank account on the booking flow with a list of admin-managed bank accounts. The customer does **not** pre-pick an account; they see all active accounts and transfer to whichever they prefer. Active accounts are ordered by an admin-controlled `sort_order`.

**In scope:**
- New `payment_bank_accounts` table (one-to-many)
- Migration that backfills the single existing account into the new table and drops the now-obsolete columns from `payment_settings`
- Admin CRUD (list, add, edit, delete, activate/deactivate, reorder)
- Booking picker renders 0, 1, or N active accounts correctly
- Graceful degradation when `bank_transfer_enabled=true` but zero active accounts

**Out of scope:**
- Customer selecting a specific account to transfer to (and recording that choice on the appointment)
- Drag-and-drop reorder (use up/down arrow buttons — simpler, works on mobile, no new deps)
- Soft-delete semantics (appointments do not FK to accounts; hard delete with a confirm dialog is fine)
- Encrypting RIB/IBAN at rest (still deferred — MVP stance unchanged)

## 2. Data model — migration `019_payment_bank_accounts.sql`

This migration is **destructive** (drops columns from `payment_settings`). The backfill must run before the drop. Review the full migration before applying to any environment that has real admin data in `payment_settings`.

```sql
-- 1. New table: one row per bank account the admin wants to display.
CREATE TABLE public.payment_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT,                          -- optional admin-facing nickname e.g. "Personal", "Business"
  account_holder TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  rib TEXT NOT NULL,                   -- Moroccan 24-digit RIB, stored as admin typed
  iban TEXT,
  swift_bic TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_bank_accounts_active_order
  ON public.payment_bank_accounts(is_active, sort_order);

CREATE TRIGGER payment_bank_accounts_set_updated_at
  BEFORE UPDATE ON public.payment_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 2. RLS: anon can SELECT only active rows; admins see/mutate everything.
ALTER TABLE public.payment_bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY payment_bank_accounts_public_read_active ON public.payment_bank_accounts
  FOR SELECT
  USING (
    is_active = true
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY payment_bank_accounts_admin_write ON public.payment_bank_accounts
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- 3. Backfill: if the singleton row has a complete account, move it in as the first account.
INSERT INTO public.payment_bank_accounts (account_holder, bank_name, rib, iban, swift_bic, sort_order, is_active)
SELECT account_holder, bank_name, rib, iban, swift_bic, 0, true
FROM public.payment_settings
WHERE rib IS NOT NULL AND account_holder IS NOT NULL AND bank_name IS NOT NULL;

-- 4. Safety net: if bank_transfer was enabled but backfill produced zero accounts
-- (incomplete singleton row), disable the toggle so the booking UI doesn't present
-- an empty bank-transfer option.
UPDATE public.payment_settings
SET bank_transfer_enabled = false
WHERE bank_transfer_enabled = true
  AND NOT EXISTS (SELECT 1 FROM public.payment_bank_accounts WHERE is_active = true);

-- 5. Drop the check constraint and per-account columns from payment_settings.
-- payment_settings keeps only: bank_transfer_enabled, payment_phone, instructions.
ALTER TABLE public.payment_settings DROP CONSTRAINT IF EXISTS bank_transfer_requires_details;
ALTER TABLE public.payment_settings DROP COLUMN IF EXISTS account_holder;
ALTER TABLE public.payment_settings DROP COLUMN IF EXISTS bank_name;
ALTER TABLE public.payment_settings DROP COLUMN IF EXISTS rib;
ALTER TABLE public.payment_settings DROP COLUMN IF EXISTS iban;
ALTER TABLE public.payment_settings DROP COLUMN IF EXISTS swift_bic;
```

**Why no DB-level "at least one active account when toggle is on" check?** Postgres CHECK constraints can't reference other tables. Enforce this in the admin UI (disable Save on the toggle if the accounts list is empty) and in the booking UI (hide the tile if the accounts list arrives empty). Defense in depth, not DB-enforced.

## 3. Type additions — `lib/types/database.ts`

Add:

```ts
export interface PaymentBankAccount {
  id: string;
  label: string | null;
  account_holder: string;
  bank_name: string;
  rib: string;
  iban: string | null;
  swift_bic: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
```

Narrow the existing `PaymentSettings` interface — remove `account_holder`, `bank_name`, `rib`, `iban`, `swift_bic`. Keep `bank_transfer_enabled`, `payment_phone`, `instructions`, plus the metadata fields.

## 4. Query module — `lib/queries/payment-settings.ts`

Refactor into a unified public read + split admin mutations. Keep the module path (don't rename), everything else internal.

```ts
// Single public call — one render, one Promise.all, one payload.
export async function getPublicPaymentConfig(): Promise<{
  bank_transfer_enabled: boolean;
  payment_phone: string | null;
  instructions: string | null;
  accounts: Pick<PaymentBankAccount,
    'id' | 'label' | 'account_holder' | 'bank_name' | 'rib' | 'iban' | 'swift_bic' | 'sort_order'
  >[];  // only active ones, ordered by sort_order ASC, id ASC for stability
}>;

// Admin-only. Unchanged from current shape minus the removed columns.
export async function updatePaymentSettings(patch: Partial<Omit<PaymentSettings,
  'id' | 'created_at' | 'updated_at' | 'updated_by'
>>): Promise<PaymentSettings>;

// Admin-only CRUD for accounts.
export async function listBankAccounts(opts?: { includeInactive?: boolean }): Promise<PaymentBankAccount[]>;
export async function createBankAccount(input: Omit<PaymentBankAccount,
  'id' | 'created_at' | 'updated_at' | 'sort_order'
> & { sort_order?: number }): Promise<PaymentBankAccount>;
export async function updateBankAccount(id: string, patch: Partial<Omit<PaymentBankAccount,
  'id' | 'created_at' | 'updated_at'
>>): Promise<PaymentBankAccount>;
export async function deleteBankAccount(id: string): Promise<void>;
// Reorder: accepts an ordered array of ids; writes sort_order = index for each.
export async function reorderBankAccounts(orderedIds: string[]): Promise<void>;
```

**Implementation notes:**
- `getPublicPaymentConfig` runs the settings select and the active-accounts select in parallel (`Promise.all`), not sequentially.
- `reorderBankAccounts` is the only function with a correctness trap — use `upsert` with `onConflict: 'id'` and `{ ignoreDuplicates: false }`, never individual updates (inconsistent intermediate states break the `is_active, sort_order` index ordering briefly).
- Map `42501` → "You do not have permission…" and surface PG error codes consistently (same pattern as the current `updatePaymentSettings`).
- **Rename cleanup:** delete the old `getPublicPaymentSettings` export; the booking page calls `getPublicPaymentConfig` now. One grep after the rename to confirm no stragglers.

## 5. Admin UI refactor

The admin page at `app/admin/payment/page.tsx` stays. The client component `PaymentSettingsManager.tsx` splits into **two sections stacked in a single page scroll** — no tabs, no routes:

### 5.1 "General" section (top)

Keep what's there minus the removed fields. Shown fields:
- Toggle: `bank_transfer_enabled`
- Input: `payment_phone` (WhatsApp for receipts)
- Textarea: `instructions`
- Save button

**UX rule:** if the accounts list below is empty, disable the toggle and render an inline hint "Add at least one bank account before enabling bank transfers." The toggle is a no-op otherwise.

### 5.2 "Bank accounts" section (below)

New component `PaymentBankAccountsManager.tsx`. Follow `ServicesManager.tsx` conventions exactly:
- List of cards (not a table — cards read better for sparse structured data on mobile)
- Top-right "Add bank account" button
- Each card shows: bank name (large), account holder, RIB (monospaced, with spaces every 4 digits **at display time only** — do not mutate the stored value), status pill (Active/Inactive)
- Per-card actions, right-aligned: up arrow, down arrow, edit (pencil), activate/deactivate toggle, delete (trash). Disable up on the first row and down on the last row.
- Add/Edit opens the existing `Modal` component (`app/admin/components/ui/Modal.tsx`), same layout as service edit: label, account holder*, bank name*, RIB*, IBAN, SWIFT/BIC, active toggle. Required fields marked with `*`.
- Delete opens a confirm dialog ("Delete {bank_name}? This can't be undone.") — reuse existing Modal as a confirm, don't pull in a new lib.
- Empty state: friendly card with a plus icon and "No bank accounts yet. Add one to start accepting bank transfers." + a primary Add button.
- **Optimistic updates** on reorder (update local state first, rollback on server error). Do not optimistically handle create/edit/delete — too many failure modes.
- Surface server errors through the existing `useToast()`.

### 5.3 Accessibility requirements (non-negotiable)

- Each card is a `<section aria-labelledby="acct-{id}-heading">`, bank name is the heading.
- Up/down buttons have explicit `aria-label="Move {bank_name} up"`.
- Copy buttons (both admin list and booking UI) have `aria-live="polite"` on the success text change so screen readers announce "Copied".
- Modal traps focus and restores focus to the triggering button on close (the existing `Modal` already does this — verify).
- All interactive elements have visible focus rings using the existing `focus-visible:outline-gold` pattern.

## 6. Booking UI — `app/page.tsx` changes

Replace the single-account details card. The picker tile logic is unchanged. The expanded details region becomes:

### 6.1 State changes

- Swap `paymentSettings` for `paymentConfig` (rename follows the query rename). Type is the return of `getPublicPaymentConfig`.
- Replace the single `copiedField: string | null` with `copiedField: { accountId: string; field: 'rib' | 'iban' } | null` so simultaneous accounts don't fight over a single copy flag.
- Replace `useEffect` fetch to call `getPublicPaymentConfig`.
- The bank-transfer tile visibility rule becomes: `paymentConfig?.bank_transfer_enabled && paymentConfig.accounts.length > 0`. If toggle is on but accounts is empty (admin misconfig), behave as if bank transfer is off.

### 6.2 Rendering the accounts (the UX choice)

**Three display modes, chosen by account count:**

- **0 accounts (with toggle on, from misconfig):** tile hidden, cash-only.
- **1 account:** current design — a single flat details card, no header. Minimal visual weight.
- **2+ accounts:** stacked cards, each with:
  - Bank name as card header (larger than body text, not a full `<h3>`-level shout)
  - Optional `label` shown as a small pill next to the bank name if set ("Personal", "Business")
  - Account holder, RIB (with Copy), IBAN (with Copy, if present)
  - A thin visual divider between cards, not heavy borders — the shared region already has its own container

Shared region at the bottom, outside the per-account cards, rendered **once**:
- "Reference: {first_name} {last_name}" (derived from form state — helps the customer put the right note on their transfer)
- "After you transfer, send the receipt to WhatsApp {payment_phone}. Your booking stays pending until we confirm the payment."
- `instructions` if present

### 6.3 UI/UX details to get right

- **Display-format the RIB** with a space every 4 digits for readability. Implement a tiny pure helper `formatRib(rib: string)` — do not store the formatted version.
- **Copy feedback:** swap the button label to "Copied ✓" for 1500ms (not "Copied"); keep a `font-mono` constant width so the button doesn't reflow. Respect `prefers-reduced-motion` — no fade transition if the user opted out.
- **Focus management:** when the user clicks the "Bank transfer" tile, programmatically focus the first Copy button (or the details heading if Copy isn't present) so keyboard users land in the revealed region. This replaces the existing `scrollIntoView` — keep `scrollIntoView` as well, they're complementary.
- **Radiogroup semantics:** wrap the two picker tiles in `<div role="radiogroup" aria-label="Payment method">`. They already have `role="radio"` individually; the group role is required for screen-reader grouping.
- **Skeleton loading:** if `paymentConfig` is `null` (still loading) and the user reaches step 5, render the cash tile normally and a subtle skeleton placeholder where the bank-transfer tile would go, sized identically to avoid layout shift. Once loaded, swap in the real tile (or nothing, if disabled). This matters because step 5 is reachable before the fetch resolves.
- **Empty-state collapse:** if the user had selected "Bank transfer" and the admin flipped the toggle off mid-session (paymentConfig refetch on modal reopen), silently revert `paymentMethod` to `"cash"` on next modal open — do not show an error. The defense-in-depth toast already guards submission.
- **Confirmation step (step 6):** the reminder "send your transfer receipt to {payment_phone}" stays but now applies regardless of which account the customer picks. No per-account info on step 6 — the booking row doesn't record a selection.

### 6.4 Mobile (~375px) — specific requirements

- Cards stack vertically (no horizontal grid). They already will with the existing Tailwind `max-sm:` breakpoints.
- Copy button sits to the right of the RIB on wide screens and on its own line below the RIB on narrow (< 360px) screens — the RIB + Copy pair must never overflow or get truncated.
- Tap target for Copy is at least 44x44px (iOS HIG). The current `text-[10px]` button is too small — bump interactive padding without changing visual size if needed.

## 7. Tests

### 7.1 Unit / integration (Vitest, `__tests__/booking/`)

Extend `payment-method.test.ts` (don't create a new file):
- Backfill from migration 019: seed `payment_settings` with a full account in a test transaction, run the migration's backfill + drop simulation, assert one row exists in `payment_bank_accounts` and the columns are gone from `payment_settings`.
- RLS: anon can `SELECT` from `payment_bank_accounts WHERE is_active = true`; anon cannot read inactive rows; anon cannot INSERT/UPDATE/DELETE.
- RLS: admin can CRUD all rows.
- Reorder: calling `reorderBankAccounts([c, a, b])` leaves `sort_order` = 0, 1, 2 for those ids in that order.

### 7.2 E2E (Playwright, `__tests__/e2e/booking-details-step.spec.ts`)

Extend the existing spec:
- **Zero accounts + toggle on:** seed the DB, assert bank-transfer tile is not rendered.
- **One account:** seed one active account; existing single-card test still passes (no account header needed).
- **Two accounts:** seed two active accounts with different bank names; both names render; each has its own Copy button; clicking the second account's Copy writes the second RIB to the clipboard.

### 7.3 Manual QA checklist (pre-merge, in a real browser)

Per `AGENTS.md`, UI changes require browser verification. Before reporting done:
1. Zero accounts: tile hidden, booking completes on cash.
2. One account: single card, Copy works, mobile layout OK.
3. Two+ accounts: multiple cards, each Copy works independently, visual hierarchy is clear.
4. Admin: add, edit, reorder (up/down), deactivate (disappears from booking), delete (confirm dialog, disappears immediately).
5. Admin: toggle disabled when accounts list is empty; turning off bank_transfer doesn't delete the accounts.
6. Keyboard-only flow through the picker + Copy buttons works.
7. Screen reader announces Copy success (test with VoiceOver or NVDA if available, otherwise verify `aria-live` attribute wiring manually).

## 8. Rollout order

Each step leaves the tree green. Commit after each.

1. **Migration 019.** Apply locally; confirm backfill works on a seeded singleton; confirm empty-singleton case disables the toggle; confirm RLS with anon and admin JWTs.
2. **Types + query module refactor.** Old `getPublicPaymentSettings` deleted, new `getPublicPaymentConfig` + account CRUD + reorder added. Run typecheck — booking page will break intentionally (step 4 fixes it).
3. **Booking page rewire.** Rename state, handle 0 / 1 / 2+ modes, add skeleton, add radiogroup wrapper, add RIB formatter, tighten accessibility.
4. **Admin: General section narrowing** (drop the removed field inputs, keep toggle + phone + instructions, add the "add an account first" hint on the toggle).
5. **Admin: `PaymentBankAccountsManager.tsx`** (list + Modal add/edit + delete confirm + reorder + active toggle).
6. **Tests** (unit + E2E).
7. **Manual QA** — do not skip. This feature involves real money instructions to real customers.

## 9. Non-goals / reminders

- Do not add a `payment_bank_account_id` FK to `appointments`. The customer does not pre-select. Adding it later is non-destructive if the product demands it.
- Do not add drag-and-drop for reorder. Up/down buttons work everywhere, including touch, with zero new deps.
- Do not introduce i18n, a form library, or a state manager for this feature. The established pattern wins.
- Do not surface internal error codes in customer-visible toasts. "Something went wrong, please try again" is preferable to "42501: permission denied".
- Do not commit destructive migrations to prod without verifying the backfill in a staging env first. Call this out in your final manual-QA note.
