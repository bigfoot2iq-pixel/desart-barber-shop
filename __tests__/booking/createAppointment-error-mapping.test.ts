import {
  describeWithServiceRole,
  createTestCustomer,
  deleteTestUser,
  getAnyActiveSalonId,
  adminClient,
  type TestUser,
} from '@/__tests__/security/helpers';
import { clearBookingsFor, seedTestProfessional, deleteTestProfessional } from '@/__tests__/booking/helpers';

// Mock createClient before importing createAppointment
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createClient } = require('@/lib/supabase/client') as { createClient: jest.Mock };

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  // eslint-disable-next-line no-console
  console.warn('[booking] skipping createAppointment suite: set SUPABASE_SERVICE_ROLE_KEY to run');
}

describeWithServiceRole('DB / createAppointment error mapping', () => {
  let salonId: string;
  let customer: TestUser;
  let barberId: string;
  const testDate = '2026-09-01';

  beforeAll(async () => {
    const sid = await getAnyActiveSalonId();
    if (!sid) throw new Error('no active salon');
    salonId = sid;
    customer = await createTestCustomer('createAppt-test');

    const prof = await seedTestProfessional(salonId, { displayName: 'CreateAppt Barber' });
    barberId = prof.id;
  });

  afterAll(async () => {
    await clearBookingsFor([barberId], testDate, testDate);
    await deleteTestProfessional(barberId);
    if (customer) await deleteTestUser(customer.id);
  });

  afterEach(async () => {
    createClient.mockReset();
    await clearBookingsFor([barberId], testDate, testDate);
  });

  function basePayload(overrides: Record<string, unknown> = {}) {
    return {
      customer_id: customer.id,
      professional_id: null,
      preferred_professional_id: barberId,
      location_type: 'salon',
      salon_id: salonId,
      home_address: null,
      home_latitude: null,
      home_longitude: null,
      appointment_date: testDate,
      payment_method: 'cash',
      status: 'pending',
      total_price_mad: 100,
      notes: null,
      ...overrides,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createAppointment } = require('@/lib/queries/appointments');

  test('8.1 Happy path: returns the inserted Appointment', async () => {
    createClient.mockReturnValue(customer.client);
    const result = await createAppointment(
      basePayload({ start_time: '09:00:00', end_time: '09:30:00' }),
      []
    );
    expect(result.id).toBeDefined();
    expect(result.customer_id).toBe(customer.id);
    expect(result.preferred_professional_id).toBe(barberId);
    expect(result.status).toBe('pending');
  });

  test('8.2 Double-book triggers 23P01 → throws Error("SLOT_TAKEN")', async () => {
    // Seed first booking via admin
    await adminClient().from('appointments').insert({
      customer_id: customer.id,
      professional_id: null,
      preferred_professional_id: barberId,
      location_type: 'salon',
      salon_id: salonId,
      appointment_date: testDate,
      start_time: '10:00:00',
      end_time: '10:30:00',
      payment_method: 'cash',
      status: 'pending',
      total_price_mad: 100,
      notes: null,
    });

    createClient.mockReturnValue(customer.client);
    try {
      await createAppointment(
        basePayload({ start_time: '10:00:00', end_time: '10:30:00' }),
        []
      );
      fail('expected SLOT_TAKEN error');
    } catch (err) {
      expect(err instanceof Error).toBe(true);
      expect((err as Error).message).toBe('SLOT_TAKEN');
    }
  });

  test('8.3 Other PG error (bad FK) → re-thrown as-is, not as SLOT_TAKEN', async () => {
    createClient.mockReturnValue(customer.client);
    try {
      await createAppointment(
        basePayload({
          professional_id: '00000000-0000-0000-0000-000000000000',
          preferred_professional_id: null,
          start_time: '11:00:00',
          end_time: '11:30:00',
        }),
        []
      );
      fail('expected FK error');
    } catch (err) {
      // createAppointment throws the raw Supabase error object for non-23P01
      expect((err as { code?: string }).code).not.toBe('23P01');
      const msg = (err as { message?: string }).message ?? '';
      expect(msg).not.toBe('SLOT_TAKEN');
    }
  });

  test('8.4 appointment_services insert with invalid service_id → document behaviour (TODO: wrap in RPC)', async () => {
    createClient.mockReturnValue(customer.client);
    try {
      await createAppointment(
        basePayload({ start_time: '12:00:00', end_time: '12:30:00' }),
        ['00000000-0000-0000-0000-000000000000']
      );
      fail('expected FK error on appointment_services');
    } catch (err) {
      // The error is thrown, but the appointment row may already exist.
      // TODO: wrap createAppointment in an RPC to make it atomic.
      expect(err).toBeDefined();
    }

    // Cleanup: check if orphaned appointment was created
    const admin = adminClient();
    const { data } = await admin
      .from('appointments')
      .select('id')
      .eq('appointment_date', testDate)
      .eq('start_time', '12:00:00')
      .eq('customer_id', customer.id);
    if (data && data.length > 0) {
      await admin.from('appointments').delete().in('id', data.map((r: { id: string }) => r.id));
    }
  });
});
