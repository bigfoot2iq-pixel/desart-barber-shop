import {
  describeWithServiceRole,
  createTestCustomer,
  deleteTestUser,
  getAnyActiveSalonId,
  adminClient,
  type TestUser,
} from '@/__tests__/security/helpers';
import { seedBooking, clearBookingsFor, seedTestProfessional, deleteTestProfessional } from '@/__tests__/booking/helpers';

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  // eslint-disable-next-line no-console
  console.warn('[booking] skipping overlap-constraint suite: set SUPABASE_SERVICE_ROLE_KEY to run');
}

describeWithServiceRole('DB / appointments_no_barber_overlap constraint', () => {
  let salonId: string;
  let customer: TestUser;
  let barberId: string;
  let barberId2: string;
  const testDate = '2026-09-01';

  beforeAll(async () => {
    const sid = await getAnyActiveSalonId();
    if (!sid) throw new Error('no active salon');
    salonId = sid;
    customer = await createTestCustomer('overlap-test');

    const prof1 = await seedTestProfessional(salonId, { displayName: 'Overlap Barber 1' });
    const prof2 = await seedTestProfessional(salonId, { displayName: 'Overlap Barber 2' });
    barberId = prof1.id;
    barberId2 = prof2.id;
  });

  afterAll(async () => {
    await clearBookingsFor([barberId, barberId2], testDate, testDate);
    await deleteTestProfessional(barberId);
    await deleteTestProfessional(barberId2);
    if (customer) await deleteTestUser(customer.id);
  });

  afterEach(async () => {
    await clearBookingsFor([barberId, barberId2], testDate, testDate);
  });

  function is23P01(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code?: string }).code === '23P01'
    );
  }

  test('7.1 Pending 09:00–09:30 preferred=B, another pending 09:00–09:30 preferred=B → 23P01', async () => {
    await seedBooking({ barberId, salonId, customerId: customer.id, date: testDate, start: '09:00', end: '09:30' });
    try {
      await seedBooking({ barberId, salonId, customerId: customer.id, date: testDate, start: '09:00', end: '09:30' });
      fail('expected 23P01');
    } catch (err) {
      expect(is23P01(err)).toBe(true);
    }
  });

  test('7.2 Pending 09:00–10:00 preferred=B, pending 09:30–10:00 preferred=B (middle overlap) → 23P01', async () => {
    await seedBooking({ barberId, salonId, customerId: customer.id, date: testDate, start: '09:00', end: '10:00' });
    try {
      await seedBooking({ barberId, salonId, customerId: customer.id, date: testDate, start: '09:30', end: '10:00' });
      fail('expected 23P01');
    } catch (err) {
      expect(is23P01(err)).toBe(true);
    }
  });

  test('7.3 Pending 09:00–10:00 preferred=B, pending 10:00–10:30 (touches end, closed-open) → succeeds', async () => {
    await seedBooking({ barberId, salonId, customerId: customer.id, date: testDate, start: '09:00', end: '10:00' });
    await expect(
      seedBooking({ barberId, salonId, customerId: customer.id, date: testDate, start: '10:00', end: '10:30' })
    ).resolves.toBeDefined();
  });

  test('7.4 Pending 09:00–09:30 preferred=B, pending 08:30–09:00 (touches start) → succeeds', async () => {
    await seedBooking({ barberId, salonId, customerId: customer.id, date: testDate, start: '09:00', end: '09:30' });
    await expect(
      seedBooking({ barberId, salonId, customerId: customer.id, date: testDate, start: '08:30', end: '09:00' })
    ).resolves.toBeDefined();
  });

  test('7.5 Same barber, different dates → succeeds', async () => {
    await seedBooking({ barberId, salonId, customerId: customer.id, date: testDate, start: '09:00', end: '09:30' });
    await expect(
      seedBooking({ barberId, salonId, customerId: customer.id, date: '2026-09-02', start: '09:00', end: '09:30' })
    ).resolves.toBeDefined();
  });

  test('7.6 professional_id=B assigned + pending preferred_professional_id=B overlap → 23P01', async () => {
    await seedBooking({ barberId, salonId, customerId: customer.id, date: testDate, start: '09:00', end: '09:30', assigned: true });
    try {
      await seedBooking({ barberId, salonId, customerId: customer.id, date: testDate, start: '09:00', end: '09:30', assigned: false });
      fail('expected 23P01');
    } catch (err) {
      expect(is23P01(err)).toBe(true);
    }
  });

  test('7.7 Cancelled 09:00–09:30 preferred=B, new pending same slot → succeeds', async () => {
    await seedBooking({ barberId, salonId, customerId: customer.id, date: testDate, start: '09:00', end: '09:30', status: 'cancelled' });
    await expect(
      seedBooking({ barberId, salonId, customerId: customer.id, date: testDate, start: '09:00', end: '09:30' })
    ).resolves.toBeDefined();
  });

  test('7.8 Completed 09:00–09:30 preferred=B, new pending same slot → succeeds', async () => {
    await seedBooking({ barberId, salonId, customerId: customer.id, date: testDate, start: '09:00', end: '09:30', status: 'completed' });
    await expect(
      seedBooking({ barberId, salonId, customerId: customer.id, date: testDate, start: '09:00', end: '09:30' })
    ).resolves.toBeDefined();
  });

  test('7.9 Status flip: pending → cancelled, then insert same slot → succeeds', async () => {
    const id = await seedBooking({ barberId, salonId, customerId: customer.id, date: testDate, start: '09:00', end: '09:30' });
    const admin = adminClient();
    await admin.from('appointments').update({ status: 'cancelled' }).eq('id', id);
    await expect(
      seedBooking({ barberId, salonId, customerId: customer.id, date: testDate, start: '09:00', end: '09:30' })
    ).resolves.toBeDefined();
  });

  test('7.10 Status flip: cancelled → pending with existing overlap → 23P01', async () => {
    await seedBooking({ barberId, salonId, customerId: customer.id, date: testDate, start: '09:00', end: '09:30' });
    // Insert a second appointment at a non-overlapping time (11:00), then
    // update it to the overlapping slot with cancelled status. Direct
    // cancelled inserts are blocked by the insert trigger.
    const id = await seedBooking({ barberId, salonId, customerId: customer.id, date: testDate, start: '11:00', end: '11:30' });
    const admin = adminClient();
    // Update to the overlapping time + cancelled status (update trigger falls
    // through for service-role client since auth.uid() is NULL).
    const { error: updateError } = await admin
      .from('appointments')
      .update({ status: 'cancelled', start_time: '09:00:00', end_time: '09:30:00' })
      .eq('id', id);
    if (updateError) throw new Error(`update to cancelled failed: ${updateError.message}`);

    try {
      const { error } = await admin
        .from('appointments')
        .update({ status: 'pending' })
        .eq('id', id);
      if (!error) fail('expected 23P01 on update');
      expect(error.code).toBe('23P01');
    } catch (err) {
      expect(is23P01(err)).toBe(true);
    }
  });

  test('7.11 Different barbers, same slot → succeeds', async () => {
    await seedBooking({ barberId, salonId, customerId: customer.id, date: testDate, start: '09:00', end: '09:30' });
    await expect(
      seedBooking({ barberId: barberId2, salonId, customerId: customer.id, date: testDate, start: '09:00', end: '09:30' })
    ).resolves.toBeDefined();
  });

  test('7.12 Both professional_id and preferred_professional_id NULL → both succeed (NULL ≠ NULL in EXCLUDE)', async () => {
    const admin = adminClient();
    const payload1 = {
      customer_id: customer.id,
      professional_id: null,
      preferred_professional_id: null,
      location_type: 'salon',
      salon_id: salonId,
      appointment_date: testDate,
      start_time: '09:00:00',
      end_time: '09:30:00',
      payment_method: 'cash',
      status: 'pending',
      total_price_mad: 100,
      notes: null,
    };
    const { error: err1 } = await admin.from('appointments').insert(payload1);
    expect(err1).toBeNull();
    const { error: err2 } = await admin.from('appointments').insert(payload1);
    expect(err2).toBeNull();
  });

  test('7.13 Race condition: Promise.all([insertA, insertB]) same barber/time → exactly one 23P01', async () => {
    const results = await Promise.allSettled([
      seedBooking({ barberId, salonId, customerId: customer.id, date: testDate, start: '14:00', end: '14:30' }),
      seedBooking({ barberId, salonId, customerId: customer.id, date: testDate, start: '14:00', end: '14:30' }),
    ]);
    const successes = results.filter((r) => r.status === 'fulfilled');
    const rejections = results.filter(
      (r) => r.status === 'rejected' && is23P01(r.reason)
    );
    expect(successes).toHaveLength(1);
    expect(rejections).toHaveLength(1);
  });
});
