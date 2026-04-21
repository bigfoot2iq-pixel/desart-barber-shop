-- ============================================================
-- 014: Booked slots RPC + overlap guard for double-booking
-- ============================================================

-- 1. SECURITY DEFINER function so public/anonymous callers can
--    see pending + confirmed bookings for any barber, bypassing RLS.
CREATE OR REPLACE FUNCTION public.get_barber_booked_slots(
  p_barber_ids uuid[],
  p_from date,
  p_to date
)
RETURNS TABLE (
  barber_id uuid,
  appointment_date date,
  start_time time,
  end_time time
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(a.professional_id, a.preferred_professional_id) AS barber_id,
    a.appointment_date,
    a.start_time,
    a.end_time
  FROM public.appointments a
  WHERE COALESCE(a.professional_id, a.preferred_professional_id) = ANY(p_barber_ids)
    AND a.appointment_date >= p_from
    AND a.appointment_date <= p_to
    AND a.status IN ('pending', 'confirmed');
$$;

GRANT EXECUTE ON FUNCTION public.get_barber_booked_slots(uuid[], date, date) TO anon, authenticated;

-- 2. Overlap guard: prevent double-booking the same barber.
--    Requires btree_gist for the "=" operator inside an exclusion constraint.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_no_barber_overlap
  EXCLUDE USING gist (
    (COALESCE(professional_id, preferred_professional_id)) WITH =,
    tsrange(
      appointment_date + start_time,
      appointment_date + end_time,
      '[)'
    ) WITH &&
  )
  WHERE (status IN ('pending', 'confirmed'));
