CREATE TABLE invitation_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin', 'professional')),
  token         UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  invited_by    UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '15 minutes'),
  used_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE invitation_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access" ON invitation_tokens
  FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );