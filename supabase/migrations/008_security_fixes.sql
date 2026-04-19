-- ============================================================
-- Security hardening: close privilege-escalation and PII-leak holes
-- introduced by overly permissive RLS policies in migrations 003/005.
-- Idempotent: all policies are dropped before being (re)created.
-- ============================================================

-- ---------------------------------------------------------------
-- 1. profiles: prevent non-admins from changing role / id / email
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_profile_update_constraints()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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

DROP TRIGGER IF EXISTS trg_enforce_profile_update ON public.profiles;
CREATE TRIGGER trg_enforce_profile_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profile_update_constraints();

-- ---------------------------------------------------------------
-- 2. profiles: restrict SELECT
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "Profiles: anyone can read active profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: users can read own" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: admins can read all" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: assigned professional can read customer" ON public.profiles;

CREATE POLICY "Profiles: users can read own"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Profiles: admins can read all"
  ON public.profiles FOR SELECT
  USING (public.get_current_user_role() = 'admin');

CREATE POLICY "Profiles: assigned professional can read customer"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.customer_id = profiles.id
        AND a.professional_id = auth.uid()
    )
  );

REVOKE SELECT ON TABLE public.profiles FROM anon;

-- ---------------------------------------------------------------
-- 3. professionals: only expose active rows to the public
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_professional_update_constraints()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.get_current_user_role() = 'admin' THEN
    RETURN NEW;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'professionals.id is immutable';
  END IF;
  IF NEW.salon_id IS DISTINCT FROM OLD.salon_id THEN
    RAISE EXCEPTION 'professionals.salon_id can only be changed by an admin';
  END IF;
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'professionals.is_active can only be changed by an admin';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_professional_update ON public.professionals;
CREATE TRIGGER trg_enforce_professional_update
  BEFORE UPDATE ON public.professionals
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_professional_update_constraints();

DROP POLICY IF EXISTS "Professionals: anyone can read active professionals" ON public.professionals;
DROP POLICY IF EXISTS "Professionals: anyone can read active" ON public.professionals;
DROP POLICY IF EXISTS "Professionals: admins can read all" ON public.professionals;
DROP POLICY IF EXISTS "Professionals: self can read own" ON public.professionals;

CREATE POLICY "Professionals: anyone can read active"
  ON public.professionals FOR SELECT
  USING (is_active = true);

CREATE POLICY "Professionals: admins can read all"
  ON public.professionals FOR SELECT
  USING (public.get_current_user_role() = 'admin');

CREATE POLICY "Professionals: self can read own"
  ON public.professionals FOR SELECT
  USING (id = auth.uid());

-- ---------------------------------------------------------------
-- 4. salons: only expose active to public
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "Salons: anyone can read active salons" ON public.salons;
DROP POLICY IF EXISTS "Salons: anyone can read active" ON public.salons;
DROP POLICY IF EXISTS "Salons: admins can read all" ON public.salons;

CREATE POLICY "Salons: anyone can read active"
  ON public.salons FOR SELECT
  USING (is_active = true);

CREATE POLICY "Salons: admins can read all"
  ON public.salons FOR SELECT
  USING (public.get_current_user_role() = 'admin');

-- ---------------------------------------------------------------
-- 5. services: only expose active to public
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "Services: anyone can read active services" ON public.services;
DROP POLICY IF EXISTS "Services: anyone can read active" ON public.services;
DROP POLICY IF EXISTS "Services: admins can read all" ON public.services;

CREATE POLICY "Services: anyone can read active"
  ON public.services FOR SELECT
  USING (is_active = true);

CREATE POLICY "Services: admins can read all"
  ON public.services FOR SELECT
  USING (public.get_current_user_role() = 'admin');

-- ---------------------------------------------------------------
-- 6. appointments: lock down what customers/professionals can change
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_appointment_update_constraints()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  non_status_changed boolean;
BEGIN
  IF public.get_current_user_role() = 'admin' THEN
    RETURN NEW;
  END IF;

  non_status_changed :=
       NEW.customer_id IS DISTINCT FROM OLD.customer_id
    OR NEW.professional_id IS DISTINCT FROM OLD.professional_id
    OR NEW.preferred_professional_id IS DISTINCT FROM OLD.preferred_professional_id
    OR NEW.location_type IS DISTINCT FROM OLD.location_type
    OR NEW.salon_id IS DISTINCT FROM OLD.salon_id
    OR NEW.home_address IS DISTINCT FROM OLD.home_address
    OR NEW.home_latitude IS DISTINCT FROM OLD.home_latitude
    OR NEW.home_longitude IS DISTINCT FROM OLD.home_longitude
    OR NEW.appointment_date IS DISTINCT FROM OLD.appointment_date
    OR NEW.start_time IS DISTINCT FROM OLD.start_time
    OR NEW.end_time IS DISTINCT FROM OLD.end_time
    OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
    OR NEW.total_price_mad IS DISTINCT FROM OLD.total_price_mad;

  -- Assigned professional: may only change status/notes on their rows
  IF OLD.professional_id IS NOT NULL AND OLD.professional_id = auth.uid() THEN
    IF non_status_changed THEN
      RAISE EXCEPTION 'professionals may only change status/notes on assigned appointments';
    END IF;
    RETURN NEW;
  END IF;

  -- Customer: may only cancel their own pending/confirmed appointments
  IF OLD.customer_id = auth.uid() THEN
    IF non_status_changed THEN
      RAISE EXCEPTION 'customers may only change status on their own appointments';
    END IF;
    IF NEW.status <> 'cancelled' THEN
      RAISE EXCEPTION 'customers may only cancel appointments (status = cancelled)';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_appointment_update ON public.appointments;
DROP TRIGGER IF EXISTS a_enforce_appointment_update ON public.appointments;
-- Named "a_…" so it fires before "trigger_auto_confirm_appointment" (alphabetical order).
CREATE TRIGGER a_enforce_appointment_update
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_appointment_update_constraints();

-- ---------------------------------------------------------------
-- 7. appointments INSERT: stop customers from self-assigning a
--    professional or bypassing the pending status requirement
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_appointment_insert_constraints()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.get_current_user_role() = 'admin' THEN
    RETURN NEW;
  END IF;

  IF NEW.professional_id IS NOT NULL THEN
    RAISE EXCEPTION 'only admins may assign professional_id directly';
  END IF;
  IF NEW.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'new appointments must start with status = pending';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_appointment_insert ON public.appointments;
CREATE TRIGGER trg_enforce_appointment_insert
  BEFORE INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_appointment_insert_constraints();

-- ---------------------------------------------------------------
-- 8. professional_services: remove self-serve assignment/deletion
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "Professional services: professionals can update own" ON public.professional_services;
DROP POLICY IF EXISTS "Professional services: professionals can delete own" ON public.professional_services;

-- ---------------------------------------------------------------
-- 9. availability / overrides: prevent re-assigning professional_id
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_availability_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.get_current_user_role() = 'admin' THEN
    RETURN NEW;
  END IF;
  IF NEW.professional_id IS DISTINCT FROM OLD.professional_id THEN
    RAISE EXCEPTION 'professional_id is immutable for non-admins';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_availability_update ON public.professional_availability;
CREATE TRIGGER trg_enforce_availability_update
  BEFORE UPDATE ON public.professional_availability
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_availability_ownership();

DROP TRIGGER IF EXISTS trg_enforce_overrides_update ON public.availability_overrides;
CREATE TRIGGER trg_enforce_overrides_update
  BEFORE UPDATE ON public.availability_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_availability_ownership();
