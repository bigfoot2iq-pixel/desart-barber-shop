import {
  adminClient,
  anonClient,
  userClient,
  createTestCustomer,
  deleteTestUser,
  describeWithServiceRole,
  type TestUser,
} from '@/__tests__/security/helpers';

// ---------------------------------------------------------------------------
// Weekly availability helpers
// ---------------------------------------------------------------------------

export type WeeklyDayConfig = {
  dayOfWeek: number;
  isAvailable: boolean;
  startTime: string;
  endTime: string;
};

export async function seedWeeklyAvailability(
  professionalId: string,
  daysConfig: WeeklyDayConfig[]
): Promise<void> {
  const admin = adminClient();
  const rows = daysConfig.map((d) => ({
    professional_id: professionalId,
    day_of_week: d.dayOfWeek,
    start_time: d.startTime,
    end_time: d.endTime,
    is_available: d.isAvailable,
  }));
  const { error } = await admin.from('professional_availability').insert(rows);
  if (error) throw new Error(`seedWeeklyAvailability failed: ${error.message}`);
}

export async function clearWeeklyAvailability(professionalId: string): Promise<void> {
  const admin = adminClient();
  await admin.from('professional_availability').delete().eq('professional_id', professionalId);
}

// ---------------------------------------------------------------------------
// Override helpers
// ---------------------------------------------------------------------------

export type OverrideConfig = {
  isAvailable: boolean;
  start?: string;
  end?: string;
  reason?: string;
};

export async function seedOverride(
  professionalId: string,
  date: string,
  config: OverrideConfig
): Promise<void> {
  const admin = adminClient();
  const row: Record<string, unknown> = {
    professional_id: professionalId,
    override_date: date,
    is_available: config.isAvailable,
    reason: config.reason ?? null,
  };
  if (config.isAvailable && config.start && config.end) {
    row.start_time = config.start;
    row.end_time = config.end;
  } else {
    row.start_time = null;
    row.end_time = null;
  }
  const { error } = await admin.from('availability_overrides').insert(row);
  if (error) throw new Error(`seedOverride failed: ${error.message}`);
}

export async function clearOverrides(professionalId: string): Promise<void> {
  const admin = adminClient();
  await admin.from('availability_overrides').delete().eq('professional_id', professionalId);
}

// ---------------------------------------------------------------------------
// Booking helpers
// ---------------------------------------------------------------------------

export type SeedBookingConfig = {
  barberId: string;
  date: string;
  start: string;
  end: string;
  status?: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  assigned?: boolean;
  customerId?: string;
  salonId: string;
};

export async function seedBooking(config: SeedBookingConfig): Promise<string> {
  const admin = adminClient();

  // Step 1: Insert as pending/unassigned to pass the insert trigger
  // (enforce_appointment_insert_constraints blocks non-pending and
  // professional_id when get_current_user_role() != 'admin', which is the
  // case for the service-role client with no auth session).
  const insertPayload: Record<string, unknown> = {
    customer_id: config.customerId ?? '00000000-0000-0000-0000-000000000000',
    appointment_date: config.date,
    start_time: config.start,
    end_time: config.end,
    location_type: 'salon',
    salon_id: config.salonId,
    home_address: null,
    home_latitude: null,
    home_longitude: null,
    payment_method: 'cash',
    status: 'pending',
    total_price_mad: 100,
    notes: null,
    professional_id: null,
    preferred_professional_id: config.barberId,
  };

  const { data, error } = await admin.from('appointments').insert(insertPayload).select('id').single();
  if (error || !data) {
    // Re-throw the original Supabase error object so callers can inspect
    // the .code property (e.g. '23P01' for exclusion constraint violations).
    throw error ?? new Error('seedBooking failed: no row returned');
  }
  const id = (data as { id: string }).id;

  // Step 2: If the caller requested a non-pending status or an assigned
  // professional_id, UPDATE the row. The update trigger falls through to
  // RETURN NEW when auth.uid() is NULL (service-role client), so this works.
  const needsUpdate =
    (config.status && config.status !== 'pending') || config.assigned;

  if (needsUpdate) {
    const updates: Record<string, unknown> = {};
    if (config.status && config.status !== 'pending') {
      updates.status = config.status;
    }
    if (config.assigned) {
      updates.professional_id = config.barberId;
      updates.preferred_professional_id = null;
    }

    const { error: updateError } = await admin
      .from('appointments')
      .update(updates)
      .eq('id', id);
    if (updateError) {
      // Best-effort cleanup
      await admin.from('appointments').delete().eq('id', id);
      throw new Error(`seedBooking update failed: ${updateError.message}`);
    }
  }

  return id;
}

export async function clearBookingsFor(
  barberIds: string[],
  dateFrom: string,
  dateTo: string
): Promise<void> {
  const admin = adminClient();
  let query = admin
    .from('appointments')
    .delete()
    .gte('appointment_date', dateFrom)
    .lte('appointment_date', dateTo);

  if (barberIds.length > 0) {
    query = query.or(
      `professional_id.in.(${barberIds.join(',')}),preferred_professional_id.in.(${barberIds.join(',')})`
    );
  }

  const { error } = await query;
  if (error) throw new Error(`clearBookingsFor failed: ${error.message}`);
}

// ---------------------------------------------------------------------------
// RPC helpers
// ---------------------------------------------------------------------------

export async function callRpcAsAnon(
  barberIds: string[],
  from: string,
  to: string
): Promise<{ barber_id: string; appointment_date: string; start_time: string; end_time: string }[]> {
  const client = anonClient();
  const { data, error } = await client.rpc('get_barber_booked_slots', {
    p_barber_ids: barberIds,
    p_from: from,
    p_to: to,
  });
  if (error) throw new Error(`callRpcAsAnon failed: ${error.message}`);
  return data as { barber_id: string; appointment_date: string; start_time: string; end_time: string }[];
}

export async function callRpcAsCustomer(
  client: ReturnType<typeof userClient>,
  barberIds: string[],
  from: string,
  to: string
): Promise<{ barber_id: string; appointment_date: string; start_time: string; end_time: string }[]> {
  const { data, error } = await client.rpc('get_barber_booked_slots', {
    p_barber_ids: barberIds,
    p_from: from,
    p_to: to,
  });
  if (error) throw new Error(`callRpcAsCustomer failed: ${error.message}`);
  return data as { barber_id: string; appointment_date: string; start_time: string; end_time: string }[];
}

// ---------------------------------------------------------------------------
// Professional fixture helpers
// ---------------------------------------------------------------------------

export type ProfessionalFixtureConfig = {
  offersHomeVisit?: boolean;
  displayName?: string;
  phone?: string;
  yearsOfExperience?: number;
};

export async function seedTestProfessional(
  salonId: string,
  config: ProfessionalFixtureConfig = {}
): Promise<{ id: string; userId: string }> {
  const admin = adminClient();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `prof-${suffix}@desart-tests.invalid`;
  const password = `P@ss-${suffix}`;

  // Create auth user
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError || !authData.user) {
    throw new Error(`seedTestProfessional: auth user creation failed: ${authError?.message ?? 'no user'}`);
  }

  // Insert professional row (profile row is auto-created by trigger)
  const { data, error } = await admin
    .from('professionals')
    .insert({
      id: authData.user.id,
      salon_id: salonId,
      display_name: config.displayName ?? `Test Pro ${suffix}`,
      phone: config.phone ?? `+212600000000`,
      years_of_experience: config.yearsOfExperience ?? 1,
      offers_home_visit: config.offersHomeVisit ?? false,
      is_active: true,
    })
    .select('id')
    .single();

  if (error || !data) {
    // Best-effort cleanup
    await admin.auth.admin.deleteUser(authData.user.id).catch(() => {});
    throw new Error(`seedTestProfessional: insert failed: ${error?.message ?? 'no row'}`);
  }

  return { id: (data as { id: string }).id, userId: authData.user.id };
}

export async function deleteTestProfessional(id: string): Promise<void> {
  const admin = adminClient();
  // Deleting the professional row cascades to profile, which cascades to auth.user
  await admin.from('professionals').delete().eq('id', id);
}

// Re-export security helpers for convenience
export {
  adminClient,
  anonClient,
  userClient,
  createTestCustomer,
  deleteTestUser,
  describeWithServiceRole,
  type TestUser,
};
