-- ============================================================
-- Fix: invited admins/professionals couldn't actually use their role.
--
-- The invite/accept flow updates auth.users.app_metadata.role via the
-- service-role client, then UPDATE profiles SET role = ...  Because RLS
-- policies key off profiles.role (via get_current_user_role()), the
-- profile update is what actually unlocks RLS for the user.
--
-- But the BEFORE UPDATE trigger enforce_profile_update_constraints
-- (migration 008) only let role changes through when
-- get_current_user_role() = 'admin'.  Service-role calls have
-- auth.uid() = NULL, so the function returned NULL and the trigger
-- raised "profiles.role can only be changed by an admin".  The route
-- logged the error and continued, leaving profiles.role = 'customer'
-- while app_metadata.role = 'admin'.  The user could load /admin (page
-- guards check app_metadata) but every RLS-gated read/write failed.
--
-- Fix: allow service_role to bypass the trigger.  The service role key
-- is server-only and already trusted (used by the invite acceptance
-- handler, notification jobs, etc.).
--
-- Also: backfill profiles.role from auth.users.raw_app_meta_data for any
-- users where the two have already drifted (existing invited admins).
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_profile_update_constraints()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Trusted server-side callers (invite acceptance, admin scripts) use
  -- the service role key and bypass these checks.
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF public.get_current_user_role() = 'admin' THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'profiles.role can only be changed by an admin';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'profiles.id is immutable';
  END IF;
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'profiles.email must be updated via auth.users';
  END IF;

  RETURN NEW;
END;
$$;

-- Backfill: sync profiles.role with auth.users.raw_app_meta_data->>'role'
-- for any users where they've drifted.  This recovers existing invited
-- admins/professionals whose profile updates were rejected.
--
-- The Supabase SQL editor runs without a JWT, so neither the
-- service_role bypass above nor get_current_user_role() match here —
-- the trigger would still block the UPDATE.  Disable it for the scope
-- of this migration only.
ALTER TABLE public.profiles DISABLE TRIGGER trg_enforce_profile_update;

UPDATE public.profiles p
SET role = (u.raw_app_meta_data ->> 'role')
FROM auth.users u
WHERE p.id = u.id
  AND (u.raw_app_meta_data ->> 'role') IS NOT NULL
  AND (u.raw_app_meta_data ->> 'role') IN ('admin', 'professional', 'customer')
  AND p.role IS DISTINCT FROM (u.raw_app_meta_data ->> 'role');

ALTER TABLE public.profiles ENABLE TRIGGER trg_enforce_profile_update;
