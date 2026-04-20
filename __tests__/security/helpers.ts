import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
export const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const hasServiceRole = Boolean(SERVICE_ROLE_KEY);

// Run the suite only when a service-role key is present. Without it we can't
// create real authenticated users, so the "what authenticated customers
// can't do" checks would have no session to run against.
export const describeWithServiceRole = hasServiceRole ? describe : describe.skip;

export function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function adminClient(): SupabaseClient {
  if (!SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin operations');
  }
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Creates a fresh auth client scoped to a single test user so multiple users
// can be signed in side-by-side without clobbering each other's sessions.
export function userClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type TestUser = {
  id: string;
  email: string;
  password: string;
  client: SupabaseClient;
};

/**
 * Create a confirmed auth user via the admin API, then sign them in on a
 * scoped client. The DB trigger auto-creates their profile with role='customer'.
 */
export async function createTestCustomer(label: string): Promise<TestUser> {
  const admin = adminClient();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `sec-${label}-${suffix}@desart-tests.invalid`;
  const password = `P@ss-${suffix}-${Math.random().toString(36).slice(2, 10)}`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`admin createUser failed: ${error?.message ?? 'no user returned'}`);
  }

  const client = userClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) {
    throw new Error(`signInWithPassword failed: ${signInError.message}`);
  }

  return { id: data.user.id, email, password, client };
}

export async function deleteTestUser(userId: string): Promise<void> {
  if (!hasServiceRole) return;
  const admin = adminClient();
  await admin.auth.admin.deleteUser(userId).catch(() => {
    // best-effort cleanup — don't fail the suite on cleanup errors
  });
}

/**
 * Grab a valid active salon id for building appointment fixtures. Read via
 * anon so we hit a policy we already trust ("anyone can read active salons").
 */
export async function getAnyActiveSalonId(): Promise<string | null> {
  const client = anonClient();
  const { data, error } = await client.from('salons').select('id').eq('is_active', true).limit(1);
  if (error || !data || data.length === 0) return null;
  return (data[0] as { id: string }).id;
}

export async function getAnyActiveProfessionalId(): Promise<string | null> {
  const client = anonClient();
  const { data, error } = await client
    .from('professionals')
    .select('id')
    .eq('is_active', true)
    .limit(1);
  if (error || !data || data.length === 0) return null;
  return (data[0] as { id: string }).id;
}

type AppointmentOverrides = Partial<{
  customer_id: string;
  professional_id: string | null;
  preferred_professional_id: string | null;
  location_type: 'salon' | 'home';
  salon_id: string | null;
  home_address: string | null;
  home_latitude: number | null;
  home_longitude: number | null;
  appointment_date: string;
  start_time: string;
  end_time: string;
  payment_method: 'cash' | 'bank_transfer';
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  total_price_mad: number;
  notes: string | null;
}>;

/** Build an appointment payload that satisfies CHECK constraints but still
 *  relies on RLS/triggers for authorization. */
export function buildAppointmentPayload(overrides: AppointmentOverrides = {}) {
  return {
    customer_id: overrides.customer_id ?? '00000000-0000-0000-0000-000000000000',
    professional_id: overrides.professional_id ?? null,
    preferred_professional_id: overrides.preferred_professional_id ?? null,
    location_type: overrides.location_type ?? 'salon',
    salon_id: overrides.salon_id ?? null,
    home_address: overrides.home_address ?? null,
    home_latitude: overrides.home_latitude ?? null,
    home_longitude: overrides.home_longitude ?? null,
    appointment_date: overrides.appointment_date ?? '2099-01-01',
    start_time: overrides.start_time ?? '10:00:00',
    end_time: overrides.end_time ?? '10:30:00',
    payment_method: overrides.payment_method ?? 'cash',
    status: overrides.status ?? 'pending',
    total_price_mad: overrides.total_price_mad ?? 100,
    notes: overrides.notes ?? null,
  };
}

/**
 * Bypass RLS (via the admin client) to create a seed appointment for test setup.
 * Does NOT run the `enforce_appointment_insert_constraints` trigger paths
 * meaningfully (admin is allowed through), which is what we want for seeding.
 */
export async function seedAppointmentAsAdmin(
  customerId: string,
  salonId: string,
  overrides: AppointmentOverrides = {}
): Promise<string> {
  const admin = adminClient();
  const payload = buildAppointmentPayload({
    customer_id: customerId,
    salon_id: salonId,
    location_type: 'salon',
    ...overrides,
  });
  const { data, error } = await admin.from('appointments').insert(payload).select('id').single();
  if (error || !data) {
    throw new Error(`seed appointment failed: ${error?.message ?? 'no row'}`);
  }
  return (data as { id: string }).id;
}

export async function deleteAppointmentAsAdmin(appointmentId: string): Promise<void> {
  if (!hasServiceRole) return;
  const admin = adminClient();
  await admin.from('appointments').delete().eq('id', appointmentId).then(() => void 0);
}
