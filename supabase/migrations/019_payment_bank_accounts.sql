-- Migrate singleton bank-account columns into a one-to-many table.
-- This migration is DESTRUCTIVE: it drops columns from payment_settings.
-- The backfill runs before the drop. Verify in staging before applying to prod.

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
