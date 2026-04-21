-- Distinguish admin vs. customer deliveries in the audit log.
ALTER TABLE public.notification_deliveries
  ADD COLUMN recipient_kind TEXT NOT NULL DEFAULT 'admin'
    CHECK (recipient_kind IN ('admin', 'customer'));

-- channel_id becomes nullable for customer deliveries (no channel row involved).
-- It's already nullable via ON DELETE SET NULL in migration 012, so no schema change.
