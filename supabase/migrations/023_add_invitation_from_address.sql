-- Add a dedicated sender address for invitation emails (customer notifications keep their own address)
ALTER TABLE customer_notification_settings
ADD COLUMN IF NOT EXISTS invitation_from_address TEXT;