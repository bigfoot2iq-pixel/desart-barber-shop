import {
  describeWithServiceRole,
  createTestCustomer,
  deleteTestUser,
  getAnyActiveSalonId,
  anonClient,
  userClient,
  type TestUser,
} from '@/__tests__/security/helpers';
import {
  callRpcAsAnon,
  callRpcAsCustomer,
  seedBooking,
  clearBookingsFor,
  seedTestProfessional,
  deleteTestProfessional,
} from '@/__tests__/booking/helpers';

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  // eslint-disable-next-line no-console
  console.warn('[booking] skipping RLS-availability suite: set SUPABASE_SERVICE_ROLE_KEY to run');
}

describeWithServiceRole('DB / RLS boundary for appointments', () => {
  let salonId: string;
  let customerA: TestUser;
  let customerB: TestUser;
  let barberId: string;
  const testDate = '2026-09-01';

  beforeAll(async () => {
    const sid = await getAnyActiveSalonId();
    if (!sid) throw new Error('no active salon');
    salonId = sid;
    customerA = await createTestCustomer('rls-cust-a');
    customerB = await createTestCustomer('rls-cust-b');

    const prof = await seedTestProfessional(salonId, { displayName: 'RLS Barber' });
    barberId = prof.id;
  });

  afterAll(async () => {
    await clearBookingsFor([barberId], testDate, testDate);
    await deleteTestProfessional(barberId);
    if (customerA) await deleteTestUser(customerA.id);
    if (customerB) await deleteTestUser(customerB.id);
  });

  afterEach(async () => {
    await clearBookingsFor([barberId], testDate, testDate);
  });

  test('10.1 Anon SELECT * FROM appointments → empty (RLS blocks direct reads)', async () => {
    await seedBooking({ barberId, salonId, customerId: customerA.id, date: testDate, start: '09:00', end: '09:30' });

    const { data, error } = await anonClient()
      .from('appointments')
      .select('*')
      .eq('appointment_date', testDate);

    // RLS should prevent anon from seeing any rows
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  test('10.2 Customer A reading Customer B appointment directly → blocked', async () => {
    await seedBooking({ barberId, salonId, customerId: customerB.id, date: testDate, start: '10:00', end: '10:30' });

    const { data, error } = await customerA.client
      .from('appointments')
      .select('*')
      .eq('customer_id', customerB.id);

    // RLS should prevent customer A from seeing customer B's rows
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  test('10.3 RPC from customer A returns booked slots for other customers → allowed (no PII)', async () => {
    await seedBooking({ barberId, salonId, customerId: customerB.id, date: testDate, start: '11:00', end: '11:30' });

    const rows = await callRpcAsCustomer(customerA.client, [barberId], testDate, testDate);
    expect(rows).toHaveLength(1);
    expect(rows[0].barber_id).toBe(barberId);
    // No PII should leak through the RPC
    expect(rows[0]).not.toHaveProperty('customer_id');
    expect(rows[0]).not.toHaveProperty('notes');
    expect(rows[0]).not.toHaveProperty('total_price_mad');
  });

  test('10.4 RPC column list matches exactly {barber_id, appointment_date, start_time, end_time}', async () => {
    await seedBooking({ barberId, salonId, customerId: customerA.id, date: testDate, start: '12:00', end: '12:30' });

    const rows = await callRpcAsAnon([barberId], testDate, testDate);
    expect(rows).toHaveLength(1);

    const keys = Object.keys(rows[0]).sort();
    expect(keys).toEqual(['appointment_date', 'barber_id', 'end_time', 'start_time'].sort());

    // Explicit deny-list for columns that must never appear
    const forbidden = [
      'customer_id',
      'notes',
      'total_price_mad',
      'professional_id',
      'preferred_professional_id',
      'payment_method',
      'status',
      'home_address',
      'created_at',
      'updated_at',
    ];
    for (const col of forbidden) {
      expect(rows[0]).not.toHaveProperty(col);
    }
  });
});
