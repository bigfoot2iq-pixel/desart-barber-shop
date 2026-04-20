-- ============================================================
-- Notification channels & delivery log for admin appointment alerts.
-- Used by Supabase Database Webhooks → Next.js route → fan-out.
--
-- Secrets stored plaintext in config JSONB for MVP.
-- TODO: encrypt with pgsodium symmetric encryption (master key in
-- Supabase vault) before production use.
-- ============================================================

-- -----------------------------------------------------------
-- 1. notification_channels — one row per (admin, channel, provider)
-- -----------------------------------------------------------
CREATE TABLE public.notification_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'telegram')),
  provider TEXT NOT NULL, -- 'resend' | 'whatsapp_cloud' | 'callmebot' | 'telegram_bot'
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL,
  events TEXT[] NOT NULL DEFAULT ARRAY[
    'appointment.created',
    'appointment.cancelled',
    'appointment.confirmed',
    'appointment.completed',
    'appointment.professional_assigned'
  ],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notification_channels_admin ON public.notification_channels(admin_id);
CREATE INDEX idx_notification_channels_enabled ON public.notification_channels(is_enabled) WHERE is_enabled = true;

ALTER TABLE public.notification_channels
  ADD CONSTRAINT uniq_admin_channel_provider UNIQUE (admin_id, channel, provider);

-- -----------------------------------------------------------
-- 2. notification_deliveries — audit log + idempotency
-- -----------------------------------------------------------
CREATE TABLE public.notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  channel_id UUID REFERENCES public.notification_channels(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  attempt_count INT NOT NULL DEFAULT 0,
  last_error TEXT,
  dedup_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  UNIQUE (dedup_key)
);

CREATE INDEX idx_notification_deliveries_appointment ON public.notification_deliveries(appointment_id);
CREATE INDEX idx_notification_deliveries_status ON public.notification_deliveries(status);

-- -----------------------------------------------------------
-- 3. updated_at trigger for notification_channels
-- -----------------------------------------------------------
CREATE TRIGGER set_notification_channels_updated_at
  BEFORE UPDATE ON public.notification_channels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- -----------------------------------------------------------
-- 4. RLS — admin-only (same pattern as migrations 003/005)
-- -----------------------------------------------------------
ALTER TABLE public.notification_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

-- notification_channels: admins have full CRUD
CREATE POLICY "notification_channels: admins can read"
  ON public.notification_channels FOR SELECT
  USING (get_current_user_role() = 'admin');

CREATE POLICY "notification_channels: admins can insert"
  ON public.notification_channels FOR INSERT
  WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "notification_channels: admins can update"
  ON public.notification_channels FOR UPDATE
  USING (get_current_user_role() = 'admin');

CREATE POLICY "notification_channels: admins can delete"
  ON public.notification_channels FOR DELETE
  USING (get_current_user_role() = 'admin');

-- notification_deliveries: admins can read all, system inserts via service role
CREATE POLICY "notification_deliveries: admins can read"
  ON public.notification_deliveries FOR SELECT
  USING (get_current_user_role() = 'admin');

CREATE POLICY "notification_deliveries: admins can update"
  ON public.notification_deliveries FOR UPDATE
  USING (get_current_user_role() = 'admin');
