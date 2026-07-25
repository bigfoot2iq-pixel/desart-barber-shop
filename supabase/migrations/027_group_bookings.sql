-- ============================================================
-- 027: Group bookings — one barber serves N guests back-to-back
-- ============================================================
-- A group is ONE appointment (one barber, one continuous [start,end)
-- block, one total price / tip / payment). The overlap guard and
-- booked-slots RPC (migration 014) keep working unchanged because the
-- group is a single time range on a single barber.
--
-- Per-guest detail (first name + that guest's services) lives in two
-- child tables. `appointment_services` continues to hold the flat
-- DISTINCT union of all services so every existing read path keeps
-- working; group-aware surfaces additionally read the guest tables.
-- `party_size > 1` is the group flag.

-- -----------------------------------------------------------
-- 1. Schema
-- -----------------------------------------------------------
alter table public.appointments
  add column party_size int not null default 1 check (party_size >= 1);

create table public.appointment_guests (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  name text not null,
  sort_order int not null,
  created_at timestamptz not null default now()
);
create index idx_appointment_guests_appointment on public.appointment_guests(appointment_id);

create table public.appointment_guest_services (
  appointment_guest_id uuid not null references public.appointment_guests(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete restrict,
  primary key (appointment_guest_id, service_id)
);

-- -----------------------------------------------------------
-- 2. RLS — mirror appointment_services (003_rls_policies.sql:238-272)
-- -----------------------------------------------------------
alter table public.appointment_guests enable row level security;

create policy "Appointment guests: read via appointment access"
  on public.appointment_guests for select
  using (
    exists (
      select 1 from public.appointments a
      where a.id = appointment_guests.appointment_id
      and (
        a.customer_id = auth.uid()
        or a.professional_id = auth.uid()
        or get_current_user_role() = 'admin'
      )
    )
  );

create policy "Appointment guests: customers can insert for own appointment"
  on public.appointment_guests for insert
  with check (
    exists (
      select 1 from public.appointments a
      where a.id = appointment_guests.appointment_id
      and a.customer_id = auth.uid()
    )
  );

create policy "Appointment guests: admins can insert"
  on public.appointment_guests for insert
  with check (get_current_user_role() = 'admin');

create policy "Appointment guests: admins can update"
  on public.appointment_guests for update
  using (get_current_user_role() = 'admin');

create policy "Appointment guests: admins can delete"
  on public.appointment_guests for delete
  using (get_current_user_role() = 'admin');

alter table public.appointment_guest_services enable row level security;

create policy "Appointment guest services: read via appointment access"
  on public.appointment_guest_services for select
  using (
    exists (
      select 1 from public.appointment_guests g
      join public.appointments a on a.id = g.appointment_id
      where g.id = appointment_guest_services.appointment_guest_id
      and (
        a.customer_id = auth.uid()
        or a.professional_id = auth.uid()
        or get_current_user_role() = 'admin'
      )
    )
  );

create policy "Appointment guest services: customers can insert for own appointment"
  on public.appointment_guest_services for insert
  with check (
    exists (
      select 1 from public.appointment_guests g
      join public.appointments a on a.id = g.appointment_id
      where g.id = appointment_guest_services.appointment_guest_id
      and a.customer_id = auth.uid()
    )
  );

create policy "Appointment guest services: admins can insert"
  on public.appointment_guest_services for insert
  with check (get_current_user_role() = 'admin');

create policy "Appointment guest services: admins can delete"
  on public.appointment_guest_services for delete
  using (get_current_user_role() = 'admin');

grant select, insert, update, delete on table public.appointment_guests to authenticated;
grant select, insert, update, delete on table public.appointment_guest_services to authenticated;

-- -----------------------------------------------------------
-- 3. Update guard: party_size is booking data, immutable to non-admins
--    (mirrors total_price_mad in 026_appointment_home_details.sql).
-- -----------------------------------------------------------
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
    OR NEW.total_price_mad IS DISTINCT FROM OLD.total_price_mad
    OR NEW.party_size IS DISTINCT FROM OLD.party_size;

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

-- -----------------------------------------------------------
-- 4. Atomic group insert. SECURITY INVOKER so RLS applies as the
--    calling customer (insert own appointment + own guests/services).
--    p_guests: [{ name, sort_order, service_ids: [uuid] }, ...]
--    Maps exclusion violation (double-booking) to 'SLOT_TAKEN'.
-- -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_group_appointment(
  p_appointment jsonb,
  p_guests jsonb
)
RETURNS public.appointments
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_appointment public.appointments;
  v_guest jsonb;
  v_guest_id uuid;
  v_service_id uuid;
  v_all_services uuid[] := '{}';
BEGIN
  INSERT INTO public.appointments (
    professional_id, preferred_professional_id, customer_id, location_type,
    salon_id, home_address, home_latitude, home_longitude, home_details,
    appointment_date, start_time, end_time, payment_method, status,
    total_price_mad, tip_mad, notes, party_size
  ) VALUES (
    nullif(p_appointment->>'professional_id', '')::uuid,
    nullif(p_appointment->>'preferred_professional_id', '')::uuid,
    (p_appointment->>'customer_id')::uuid,
    p_appointment->>'location_type',
    nullif(p_appointment->>'salon_id', '')::uuid,
    p_appointment->>'home_address',
    nullif(p_appointment->>'home_latitude', '')::numeric,
    nullif(p_appointment->>'home_longitude', '')::numeric,
    CASE
      WHEN p_appointment->'home_details' IS NULL
        OR p_appointment->'home_details' = 'null'::jsonb THEN NULL
      ELSE p_appointment->'home_details'
    END,
    (p_appointment->>'appointment_date')::date,
    (p_appointment->>'start_time')::time,
    (p_appointment->>'end_time')::time,
    p_appointment->>'payment_method',
    coalesce(p_appointment->>'status', 'pending'),
    (p_appointment->>'total_price_mad')::int,
    coalesce((p_appointment->>'tip_mad')::int, 0),
    p_appointment->>'notes',
    (p_appointment->>'party_size')::int
  )
  RETURNING * INTO v_appointment;

  FOR v_guest IN SELECT * FROM jsonb_array_elements(p_guests)
  LOOP
    INSERT INTO public.appointment_guests (appointment_id, name, sort_order)
    VALUES (v_appointment.id, v_guest->>'name', (v_guest->>'sort_order')::int)
    RETURNING id INTO v_guest_id;

    FOR v_service_id IN
      SELECT (jsonb_array_elements_text(v_guest->'service_ids'))::uuid
    LOOP
      INSERT INTO public.appointment_guest_services (appointment_guest_id, service_id)
      VALUES (v_guest_id, v_service_id);
      v_all_services := array_append(v_all_services, v_service_id);
    END LOOP;
  END LOOP;

  -- Flat DISTINCT union for backward-compatible reads.
  INSERT INTO public.appointment_services (appointment_id, service_id)
  SELECT v_appointment.id, s
  FROM unnest(v_all_services) AS s
  GROUP BY s;

  RETURN v_appointment;
EXCEPTION
  WHEN exclusion_violation THEN
    RAISE EXCEPTION 'SLOT_TAKEN';
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_group_appointment(jsonb, jsonb) TO authenticated;
