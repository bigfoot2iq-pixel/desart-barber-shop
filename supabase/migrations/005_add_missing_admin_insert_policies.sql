-- Add missing admin INSERT/UPDATE policies and GRANTs so admins have full CRUD
-- on all tables through RLS (no service role key needed).

-- 1. profiles: admins need INSERT (e.g. when adding a professional)
CREATE POLICY "Profiles: admins can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (get_current_user_role() = 'admin');

-- 2. appointments: admins need INSERT (e.g. creating appointments on behalf of customers)
CREATE POLICY "Appointments: admins can insert"
  ON public.appointments FOR INSERT
  WITH CHECK (get_current_user_role() = 'admin');

-- 3. appointment_services: admins need UPDATE (for modifying service selections)
CREATE POLICY "Appointment services: admins can update"
  ON public.appointment_services FOR UPDATE
  USING (get_current_user_role() = 'admin');

-- Ensure authenticated role has INSERT/UPDATE/DELETE permissions on tables
-- that admins need to write to (PostgREST checks these before RLS).
GRANT INSERT ON TABLE public.profiles TO authenticated;
GRANT UPDATE ON TABLE public.profiles TO authenticated;
GRANT DELETE ON TABLE public.profiles TO authenticated;

GRANT INSERT ON TABLE public.appointments TO authenticated;
GRANT UPDATE ON TABLE public.appointments TO authenticated;
GRANT DELETE ON TABLE public.appointments TO authenticated;

GRANT UPDATE ON TABLE public.appointment_services TO authenticated;

-- Fix: set_user_role trigger was overwriting explicit roles with 'customer'.
-- Now only sets the default when no role was provided.
CREATE OR REPLACE FUNCTION auth_hooks.set_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  IF NEW.raw_app_meta_data IS NULL THEN
    NEW.raw_app_meta_data := '{"role": "customer"}'::jsonb;
  ELSIF NOT (NEW.raw_app_meta_data ? 'role') THEN
    NEW.raw_app_meta_data := NEW.raw_app_meta_data || '{"role": "customer"}'::jsonb;
  END IF;
  RETURN NEW;
END;
$$;