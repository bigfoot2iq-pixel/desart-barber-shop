-- ============================================================
-- Fix: "Appointments: customers can cancel own" never actually
-- allowed cancellation. Without an explicit WITH CHECK, Postgres
-- reuses the USING expression for the NEW row, so the row being
-- updated had to keep status IN ('pending','confirmed') — which
-- blocks the pending→cancelled transition the policy name implies.
--
-- Give it an explicit WITH CHECK that permits exactly the
-- cancel transition the enforce_appointment_update_constraints
-- trigger also enforces.
-- ============================================================

DROP POLICY IF EXISTS "Appointments: customers can cancel own" ON public.appointments;

CREATE POLICY "Appointments: customers can cancel own"
  ON public.appointments FOR UPDATE
  USING (customer_id = auth.uid() AND status IN ('pending', 'confirmed'))
  WITH CHECK (customer_id = auth.uid() AND status = 'cancelled');
