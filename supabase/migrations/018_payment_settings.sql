-- Shop-wide payment configuration. Singleton: one active row at a time.
-- Read by anonymous users during the booking flow, writable by admin only.

-- TODO: encrypt rib/iban with pgsodium if this app ever holds real customer funds

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

-- Seed empty row so .single() reads don't 404 on a fresh deploy.
INSERT INTO public.payment_settings (singleton) VALUES (true);

-- Maintain updated_at on write.
CREATE TRIGGER payment_settings_set_updated_at
  BEFORE UPDATE ON public.payment_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

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
