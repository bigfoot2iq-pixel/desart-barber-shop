-- Track who last modified an appointment row so notification dispatch can
-- distinguish customer self-service actions from admin/professional actions.

ALTER TABLE public.appointments
  ADD COLUMN updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Backfill existing rows: assume the customer did it. This prevents
-- spurious customer emails for historical rows on first webhook fire
-- after migration.
UPDATE public.appointments SET updated_by = customer_id WHERE updated_by IS NULL;

-- Trigger: on INSERT or UPDATE from a user session, stamp updated_by with
-- auth.uid(). Service-role calls have auth.uid() = NULL and will NOT
-- overwrite the column, which is the behavior we want.
CREATE OR REPLACE FUNCTION public.set_appointment_updated_by()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.updated_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER appointments_set_updated_by
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_appointment_updated_by();
