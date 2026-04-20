-- ============================================================
-- Allow a signed-in user to recreate their own profile row if it's
-- been deleted. Without this, a profile wiped from public.profiles
-- (while auth.users still exists) becomes a dead account: the
-- handle_new_user trigger only fires on auth.users INSERT, so
-- re-login will not reseed profiles.
--
-- Two guards together:
--   1. RLS INSERT policy: id must equal auth.uid() — no one can
--      forge a profile for another user.
--   2. BEFORE INSERT trigger: for user self-inserts, force role to
--      match the JWT's app_metadata.role claim. The existing
--      enforce_profile_update_constraints trigger only covered
--      UPDATE — this closes the matching INSERT hole so a
--      self-insert can't escalate to admin/professional.
--
-- System inserts (handle_new_user via SECURITY DEFINER, or the
-- service role) run without an auth.uid() context and pass through
-- untouched, so existing seeding paths are unaffected.
-- ============================================================

DROP POLICY IF EXISTS "Profiles: users can insert own" ON public.profiles;

CREATE POLICY "Profiles: users can insert own"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.enforce_profile_insert_constraints()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role TEXT;
BEGIN
  -- Only enforce when this is a user self-insert. System/admin
  -- inserts (handle_new_user, service role) have no auth.uid()
  -- context and are trusted.
  IF auth.uid() IS NULL OR NEW.id IS DISTINCT FROM auth.uid() THEN
    RETURN NEW;
  END IF;

  jwt_role := COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role'),
    'customer'
  );

  -- Force role to match the JWT claim — can't be used to escalate.
  NEW.role := jwt_role;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_profile_insert ON public.profiles;
CREATE TRIGGER trg_enforce_profile_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profile_insert_constraints();
