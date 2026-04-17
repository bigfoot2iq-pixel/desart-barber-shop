-- ============================================================
-- Core tables for DesArt Barber Shop
-- ============================================================

-- -----------------------------------------------------------
-- 1. profiles (extends auth.users)
-- -----------------------------------------------------------
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'professional', 'customer')),
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_role ON public.profiles(role);

-- -----------------------------------------------------------
-- 2. salons
-- -----------------------------------------------------------
CREATE TABLE public.salons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude NUMERIC(9, 6) NOT NULL,
  longitude NUMERIC(9, 6) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------
-- 3. professionals (extends profiles)
-- -----------------------------------------------------------
CREATE TABLE public.professionals (
  id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE RESTRICT,
  display_name TEXT NOT NULL,
  profile_image_url TEXT,
  years_of_experience INT NOT NULL DEFAULT 0,
  phone TEXT NOT NULL,
  profession TEXT NOT NULL DEFAULT 'barber',
  offers_home_visit BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_professionals_salon ON public.professionals(salon_id);
CREATE INDEX idx_professionals_active ON public.professionals(is_active);

-- -----------------------------------------------------------
-- 4. services (global catalog, managed by admin)
-- -----------------------------------------------------------
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INT NOT NULL,
  price_mad INT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_services_active ON public.services(is_active);

-- -----------------------------------------------------------
-- 5. professional_services (junction)
-- -----------------------------------------------------------
CREATE TABLE public.professional_services (
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  PRIMARY KEY (professional_id, service_id)
);

-- -----------------------------------------------------------
-- 6. professional_availability (weekly recurring schedule)
-- -----------------------------------------------------------
CREATE TABLE public.professional_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (professional_id, day_of_week)
);

-- -----------------------------------------------------------
-- 7. availability_overrides (date-specific exceptions)
-- -----------------------------------------------------------
CREATE TABLE public.availability_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  override_date DATE NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT false,
  start_time TIME,
  end_time TIME,
  reason TEXT,
  UNIQUE (professional_id, override_date),
  CONSTRAINT valid_override_times CHECK (
    (is_available = false AND start_time IS NULL AND end_time IS NULL)
    OR
    (is_available = true AND start_time IS NOT NULL AND end_time IS NOT NULL AND start_time < end_time)
  )
);

-- -----------------------------------------------------------
-- 8. appointments
-- -----------------------------------------------------------
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
  preferred_professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  location_type TEXT NOT NULL CHECK (location_type IN ('salon', 'home')),
  salon_id UUID REFERENCES public.salons(id) ON DELETE SET NULL,
  home_address TEXT,
  home_latitude NUMERIC(9, 6),
  home_longitude NUMERIC(9, 6),
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'bank_transfer')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  total_price_mad INT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_salon_location CHECK (
    (location_type = 'salon' AND salon_id IS NOT NULL)
    OR
    (location_type = 'home')
  )
);

CREATE INDEX idx_appointments_professional ON public.appointments(professional_id);
CREATE INDEX idx_appointments_customer ON public.appointments(customer_id);
CREATE INDEX idx_appointments_date ON public.appointments(appointment_date);
CREATE INDEX idx_appointments_status ON public.appointments(status);
CREATE INDEX idx_appointments_salon ON public.appointments(salon_id);

-- -----------------------------------------------------------
-- 9. appointment_services (junction)
-- -----------------------------------------------------------
CREATE TABLE public.appointment_services (
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  PRIMARY KEY (appointment_id, service_id)
);