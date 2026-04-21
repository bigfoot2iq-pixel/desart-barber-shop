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
