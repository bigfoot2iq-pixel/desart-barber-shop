-- ============================================================
-- Row Level Security policies for DesArt Barber Shop
-- ============================================================

-- Helper function to get the current user's role from profiles
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- -----------------------------------------------------------
-- 1. profiles
-- -----------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles: anyone can read active profiles"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Profiles: users can update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Profiles: admins can update any profile"
  ON public.profiles FOR UPDATE
  USING (get_current_user_role() = 'admin')
  WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Profiles: admins can delete profiles"
  ON public.profiles FOR DELETE
  USING (get_current_user_role() = 'admin');

-- -----------------------------------------------------------
-- 2. salons
-- -----------------------------------------------------------
ALTER TABLE public.salons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Salons: anyone can read active salons"
  ON public.salons FOR SELECT
  USING (true);

CREATE POLICY "Salons: admins can insert"
  ON public.salons FOR INSERT
  WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Salons: admins can update"
  ON public.salons FOR UPDATE
  USING (get_current_user_role() = 'admin');

CREATE POLICY "Salons: admins can delete"
  ON public.salons FOR DELETE
  USING (get_current_user_role() = 'admin');

-- -----------------------------------------------------------
-- 3. professionals
-- -----------------------------------------------------------
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Professionals: anyone can read active professionals"
  ON public.professionals FOR SELECT
  USING (true);

CREATE POLICY "Professionals: admins can insert"
  ON public.professionals FOR INSERT
  WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Professionals: professionals can update own profile"
  ON public.professionals FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Professionals: admins can update any professional"
  ON public.professionals FOR UPDATE
  USING (get_current_user_role() = 'admin');

CREATE POLICY "Professionals: admins can delete"
  ON public.professionals FOR DELETE
  USING (get_current_user_role() = 'admin');

-- -----------------------------------------------------------
-- 4. services
-- -----------------------------------------------------------
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Services: anyone can read active services"
  ON public.services FOR SELECT
  USING (true);

CREATE POLICY "Services: admins can insert"
  ON public.services FOR INSERT
  WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Services: admins can update"
  ON public.services FOR UPDATE
  USING (get_current_user_role() = 'admin');

CREATE POLICY "Services: admins can delete"
  ON public.services FOR DELETE
  USING (get_current_user_role() = 'admin');

-- -----------------------------------------------------------
-- 5. professional_services
-- -----------------------------------------------------------
ALTER TABLE public.professional_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Professional services: anyone can read"
  ON public.professional_services FOR SELECT
  USING (true);

CREATE POLICY "Professional services: admins can insert"
  ON public.professional_services FOR INSERT
  WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Professional services: professionals can update own"
  ON public.professional_services FOR INSERT
  WITH CHECK (professional_id = auth.uid());

CREATE POLICY "Professional services: admins can update"
  ON public.professional_services FOR UPDATE
  USING (get_current_user_role() = 'admin');

CREATE POLICY "Professional services: professionals can delete own"
  ON public.professional_services FOR DELETE
  USING (professional_id = auth.uid());

CREATE POLICY "Professional services: admins can delete"
  ON public.professional_services FOR DELETE
  USING (get_current_user_role() = 'admin');

-- -----------------------------------------------------------
-- 6. professional_availability
-- -----------------------------------------------------------
ALTER TABLE public.professional_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Availability: anyone can read"
  ON public.professional_availability FOR SELECT
  USING (true);

CREATE POLICY "Availability: professionals can manage own"
  ON public.professional_availability FOR INSERT
  WITH CHECK (professional_id = auth.uid());

CREATE POLICY "Availability: professionals can update own"
  ON public.professional_availability FOR UPDATE
  USING (professional_id = auth.uid());

CREATE POLICY "Availability: professionals can delete own"
  ON public.professional_availability FOR DELETE
  USING (professional_id = auth.uid());

CREATE POLICY "Availability: admins can manage all"
  ON public.professional_availability FOR INSERT
  WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Availability: admins can update all"
  ON public.professional_availability FOR UPDATE
  USING (get_current_user_role() = 'admin');

CREATE POLICY "Availability: admins can delete all"
  ON public.professional_availability FOR DELETE
  USING (get_current_user_role() = 'admin');

-- -----------------------------------------------------------
-- 7. availability_overrides
-- -----------------------------------------------------------
ALTER TABLE public.availability_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Overrides: anyone can read"
  ON public.availability_overrides FOR SELECT
  USING (true);

CREATE POLICY "Overrides: professionals can manage own"
  ON public.availability_overrides FOR INSERT
  WITH CHECK (professional_id = auth.uid());

CREATE POLICY "Overrides: professionals can update own"
  ON public.availability_overrides FOR UPDATE
  USING (professional_id = auth.uid());

CREATE POLICY "Overrides: professionals can delete own"
  ON public.availability_overrides FOR DELETE
  USING (professional_id = auth.uid());

CREATE POLICY "Overrides: admins can manage all"
  ON public.availability_overrides FOR INSERT
  WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Overrides: admins can update all"
  ON public.availability_overrides FOR UPDATE
  USING (get_current_user_role() = 'admin');

CREATE POLICY "Overrides: admins can delete all"
  ON public.availability_overrides FOR DELETE
  USING (get_current_user_role() = 'admin');

-- -----------------------------------------------------------
-- 8. appointments
-- -----------------------------------------------------------
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Appointments: customers can read own"
  ON public.appointments FOR SELECT
  USING (customer_id = auth.uid());

CREATE POLICY "Appointments: professionals can read assigned"
  ON public.appointments FOR SELECT
  USING (professional_id = auth.uid());

CREATE POLICY "Appointments: admins can read all"
  ON public.appointments FOR SELECT
  USING (get_current_user_role() = 'admin');

CREATE POLICY "Appointments: authenticated users can insert"
  ON public.appointments FOR INSERT
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Appointments: professionals can update assigned"
  ON public.appointments FOR UPDATE
  USING (professional_id = auth.uid());

CREATE POLICY "Appointments: admins can update all"
  ON public.appointments FOR UPDATE
  USING (get_current_user_role() = 'admin');

CREATE POLICY "Appointments: customers can cancel own"
  ON public.appointments FOR UPDATE
  USING (customer_id = auth.uid() AND status IN ('pending', 'confirmed'));

CREATE POLICY "Appointments: admins can delete"
  ON public.appointments FOR DELETE
  USING (get_current_user_role() = 'admin');

-- -----------------------------------------------------------
-- 9. appointment_services
-- -----------------------------------------------------------
ALTER TABLE public.appointment_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Appointment services: read via appointment access"
  ON public.appointment_services FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments
      WHERE appointments.id = appointment_services.appointment_id
      AND (
        appointments.customer_id = auth.uid()
        OR appointments.professional_id = auth.uid()
        OR get_current_user_role() = 'admin'
      )
    )
  );

CREATE POLICY "Appointment services: customers can insert for own appointment"
  ON public.appointment_services FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.appointments
      WHERE appointments.id = appointment_services.appointment_id
      AND appointments.customer_id = auth.uid()
    )
  );

CREATE POLICY "Appointment services: admins can insert"
  ON public.appointment_services FOR INSERT
  WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Appointment services: admins can delete"
  ON public.appointment_services FOR DELETE
  USING (get_current_user_role() = 'admin');