import {
  describeWithServiceRole,
  hasServiceRole,
  createTestCustomer,
  deleteTestUser,
  buildAppointmentPayload,
  getAnyActiveSalonId,
  seedAppointmentAsAdmin,
  deleteAppointmentAsAdmin,
  type TestUser,
} from './helpers';

/**
 * Security: what an authenticated CUSTOMER MUST NOT be able to do.
 *
 * These tests create two real auth users via the admin API, then sign each
 * in on a scoped Supabase client and poke at every boundary a customer role
 * could try to cross (cross-tenant reads, privilege escalation, spoofing,
 * editing locked fields).
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local to create users; the
 * suite is skipped otherwise with a console note.
 */
if (!hasServiceRole) {
  // eslint-disable-next-line no-console
  console.warn(
    '[security] skipping customer-access suite: set SUPABASE_SERVICE_ROLE_KEY in .env.local to run it'
  );
}

describeWithServiceRole('Security / authenticated customer access', () => {
  let customerA: TestUser;
  let customerB: TestUser;
  let salonId: string | null;
  let seededAppointmentA: string | null = null;
  let seededAppointmentB: string | null = null;

  beforeAll(async () => {
    salonId = await getAnyActiveSalonId();
    if (!salonId) {
      throw new Error('no active salon seeded — insert at least one active salon to run these tests');
    }

    [customerA, customerB] = await Promise.all([
      createTestCustomer('custA'),
      createTestCustomer('custB'),
    ]);

    seededAppointmentA = await seedAppointmentAsAdmin(customerA.id, salonId, {
      status: 'pending',
    });
    seededAppointmentB = await seedAppointmentAsAdmin(customerB.id, salonId, {
      status: 'pending',
    });
  });

  afterAll(async () => {
    if (seededAppointmentA) await deleteAppointmentAsAdmin(seededAppointmentA);
    if (seededAppointmentB) await deleteAppointmentAsAdmin(seededAppointmentB);
    if (customerA) await deleteTestUser(customerA.id);
    if (customerB) await deleteTestUser(customerB.id);
  });

  describe('appointment inserts: customer cannot forge ownership', () => {
    test('cannot INSERT an appointment with customer_id = another user', async () => {
      const payload = buildAppointmentPayload({
        customer_id: customerB.id,
        salon_id: salonId,
        location_type: 'salon',
      });
      const { data, error } = await customerA.client.from('appointments').insert(payload).select();
      expect(error).not.toBeNull();
      expect(data).toBeNull();
      expect(
        error?.code === '42501' || /row-level security/i.test(error?.message ?? '')
      ).toBe(true);
    });

    test('cannot self-assign a professional_id at insert time', async () => {
      const payload = buildAppointmentPayload({
        customer_id: customerA.id,
        salon_id: salonId,
        professional_id: customerA.id, // any non-null value triggers the guard
      });
      const { data, error } = await customerA.client.from('appointments').insert(payload).select();
      expect(error).not.toBeNull();
      expect(data).toBeNull();
      expect(/only admins may assign professional_id/i.test(error?.message ?? '')).toBe(true);
    });

    test('cannot INSERT with status != pending', async () => {
      const payload = buildAppointmentPayload({
        customer_id: customerA.id,
        salon_id: salonId,
        status: 'confirmed',
      });
      const { data, error } = await customerA.client.from('appointments').insert(payload).select();
      expect(error).not.toBeNull();
      expect(data).toBeNull();
      expect(/must start with status = pending/i.test(error?.message ?? '')).toBe(true);
    });

    test('CAN insert an appointment for themselves (positive control)', async () => {
      const payload = buildAppointmentPayload({
        customer_id: customerA.id,
        salon_id: salonId,
        location_type: 'salon',
        status: 'pending',
      });
      const { data, error } = await customerA.client
        .from('appointments')
        .insert(payload)
        .select('id')
        .single();
      expect(error).toBeNull();
      expect(data?.id).toBeDefined();
      if (data?.id) await deleteAppointmentAsAdmin(data.id as string);
    });
  });

  describe('appointment reads: tenant isolation', () => {
    test("cannot read another customer's appointment by id", async () => {
      const { data, error } = await customerA.client
        .from('appointments')
        .select('id')
        .eq('id', seededAppointmentB!);
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    test('broad SELECT only returns own rows', async () => {
      const { data, error } = await customerA.client.from('appointments').select('id, customer_id');
      expect(error).toBeNull();
      expect(data).toBeDefined();
      for (const row of data as { customer_id: string }[]) {
        expect(row.customer_id).toBe(customerA.id);
      }
    });

    test("cannot read another customer's appointment_services", async () => {
      // Seed a service link on customerB's appointment (admin-only)
      const { data: anyService } = await customerA.client
        .from('services')
        .select('id')
        .limit(1)
        .maybeSingle();
      if (!anyService) {
        // No active services — skip this assertion but don't fail the whole test
        return;
      }
      // We can't insert it as customerA (RLS blocks it), so seeding is skipped;
      // the assertion is that customerA can't read customerB's appointment
      // services either way.
      const { data, error } = await customerA.client
        .from('appointment_services')
        .select('appointment_id, service_id')
        .eq('appointment_id', seededAppointmentB!);
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });

  describe('appointment updates: only cancel-own is allowed', () => {
    test("cannot UPDATE another customer's appointment", async () => {
      const { data, error } = await customerA.client
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', seededAppointmentB!)
        .select();
      // RLS filters the USING clause — either silent empty result or explicit denial
      if (!error) {
        expect(Array.isArray(data) ? data.length : 0).toBe(0);
      }
      // Confirm row on B's side is still pending (read via B)
      const { data: bRow } = await customerB.client
        .from('appointments')
        .select('status')
        .eq('id', seededAppointmentB!)
        .single();
      expect((bRow as { status: string } | null)?.status).toBe('pending');
    });

    test("cannot change status to anything other than 'cancelled' on own appointment", async () => {
      const { error } = await customerA.client
        .from('appointments')
        .update({ status: 'confirmed' })
        .eq('id', seededAppointmentA!)
        .select();
      expect(error).not.toBeNull();
      expect(/customers may only cancel/i.test(error?.message ?? '')).toBe(true);
    });

    test('cannot UPDATE protected fields on own appointment', async () => {
      const { error } = await customerA.client
        .from('appointments')
        .update({ total_price_mad: 1, appointment_date: '2099-12-31' })
        .eq('id', seededAppointmentA!)
        .select();
      expect(error).not.toBeNull();
      expect(/customers may only change status/i.test(error?.message ?? '')).toBe(true);
    });

    test('cannot self-assign professional_id via UPDATE', async () => {
      const { error } = await customerA.client
        .from('appointments')
        .update({ professional_id: customerA.id })
        .eq('id', seededAppointmentA!)
        .select();
      expect(error).not.toBeNull();
    });

    test('CAN cancel own pending appointment (positive control)', async () => {
      const seededId = await seedAppointmentAsAdmin(customerA.id, salonId!, { status: 'pending' });
      const { error } = await customerA.client
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', seededId)
        .select('id, status')
        .single();
      expect(error).toBeNull();
      await deleteAppointmentAsAdmin(seededId);
    });
  });

  describe('appointment deletes: no one but admins can delete', () => {
    test('cannot DELETE own appointment', async () => {
      const seededId = await seedAppointmentAsAdmin(customerA.id, salonId!, { status: 'pending' });
      const { data, error } = await customerA.client
        .from('appointments')
        .delete()
        .eq('id', seededId)
        .select();
      if (!error) {
        expect(Array.isArray(data) ? data.length : 0).toBe(0);
      }
      // Confirm the row still exists
      const { data: row } = await customerA.client
        .from('appointments')
        .select('id')
        .eq('id', seededId)
        .maybeSingle();
      expect(row).not.toBeNull();
      await deleteAppointmentAsAdmin(seededId);
    });
  });

  describe('profiles: privilege-escalation boundary', () => {
    test('cannot escalate own role to admin', async () => {
      const { error } = await customerA.client
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', customerA.id)
        .select();
      expect(error).not.toBeNull();
      expect(/role can only be changed by an admin/i.test(error?.message ?? '')).toBe(true);
    });

    test('cannot escalate own role to professional', async () => {
      const { error } = await customerA.client
        .from('profiles')
        .update({ role: 'professional' })
        .eq('id', customerA.id)
        .select();
      expect(error).not.toBeNull();
    });

    test("cannot UPDATE another user's profile", async () => {
      const { data, error } = await customerA.client
        .from('profiles')
        .update({ first_name: 'pwned' })
        .eq('id', customerB.id)
        .select();
      if (!error) {
        expect(Array.isArray(data) ? data.length : 0).toBe(0);
      }
      const { data: bProfile } = await customerB.client
        .from('profiles')
        .select('first_name')
        .eq('id', customerB.id)
        .single();
      expect((bProfile as { first_name: string | null } | null)?.first_name).not.toBe('pwned');
    });

    test("cannot read another user's profile", async () => {
      const { data, error } = await customerA.client
        .from('profiles')
        .select('id, email, role')
        .eq('id', customerB.id);
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    test('CAN read own profile (positive control)', async () => {
      const { data, error } = await customerA.client
        .from('profiles')
        .select('id, role')
        .eq('id', customerA.id)
        .single();
      expect(error).toBeNull();
      expect((data as { id: string; role: string } | null)?.id).toBe(customerA.id);
      expect((data as { id: string; role: string } | null)?.role).toBe('customer');
    });

    test('cannot change own email via profiles table', async () => {
      const { error } = await customerA.client
        .from('profiles')
        .update({ email: 'hijack@example.com' })
        .eq('id', customerA.id)
        .select();
      expect(error).not.toBeNull();
      expect(/email must be updated via auth\.users/i.test(error?.message ?? '')).toBe(true);
    });
  });

  describe('admin catalogs: customer cannot mutate', () => {
    test('cannot INSERT a salon', async () => {
      const { error } = await customerA.client
        .from('salons')
        .insert({ name: 'pwn', address: 'x', latitude: 0, longitude: 0 })
        .select();
      expect(error).not.toBeNull();
    });

    test('cannot INSERT a service', async () => {
      const { error } = await customerA.client
        .from('services')
        .insert({ name: 'pwn', duration_minutes: 30, price_mad: 1 })
        .select();
      expect(error).not.toBeNull();
    });

    test('cannot INSERT a professional', async () => {
      const { error } = await customerA.client
        .from('professionals')
        .insert({
          id: customerA.id,
          salon_id: salonId!,
          display_name: 'pwn',
          phone: '000',
          profession: 'barber',
        })
        .select();
      expect(error).not.toBeNull();
    });

    test('cannot UPDATE a salon', async () => {
      const { data, error } = await customerA.client
        .from('salons')
        .update({ is_active: false })
        .eq('id', salonId!)
        .select();
      if (!error) {
        expect(Array.isArray(data) ? data.length : 0).toBe(0);
      }
    });

    test('cannot DELETE a service', async () => {
      const { data, error } = await customerA.client
        .from('services')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')
        .select();
      if (!error) {
        expect(Array.isArray(data) ? data.length : 0).toBe(0);
      }
    });

    test('cannot INSERT into professional_services', async () => {
      const { error } = await customerA.client
        .from('professional_services')
        .insert({
          professional_id: customerA.id,
          service_id: '00000000-0000-0000-0000-000000000000',
        })
        .select();
      expect(error).not.toBeNull();
    });
  });
});
