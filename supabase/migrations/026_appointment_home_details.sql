-- Granular location details for home ("à domicile") visits.
-- Moroccan/Agadir addresses are landmark-driven and differ between a flat in a
-- résidence (bloc/étage/n° appart/digicode) and a standalone house (n° porte/rue),
-- so the structured breakdown is kept in JSONB. `home_address` continues to hold
-- the composed human-readable summary consumed by notifications/admin.
alter table public.appointments
  add column home_details jsonb;

-- Keep the customer/professional update guard in sync: home_details is
-- location data, so it must be immutable to non-admins just like home_address.
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
    OR NEW.home_details IS DISTINCT FROM OLD.home_details
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
