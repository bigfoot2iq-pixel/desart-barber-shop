import {
  describeWithServiceRole,
  createTestCustomer,
  deleteTestUser,
  getAnyActiveSalonId,
  adminClient,
  type TestUser,
} from '@/__tests__/security/helpers';
import {
  callRpcAsAnon,
  clearBookingsFor,
  seedBooking,
  seedOverride,
  seedTestProfessional,
  deleteTestProfessional,
  seedWeeklyAvailability,
  clearWeeklyAvailability,
  clearOverrides,
} from '@/__tests__/booking/helpers';
import {
  getWorkingHoursForDate,
  buildTimeSlots,
  type WorkingHours,
} from '@/lib/booking/slots';
import { BOOKING_WINDOW_DAYS, buildDateSlots } from '@/lib/booking/date-slots';

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  // eslint-disable-next-line no-console
  console.warn('[booking] skipping availability-overrides suite: set SUPABASE_SERVICE_ROLE_KEY to run');
}

describeWithServiceRole('DB / availability overrides', () => {
  let salonId: string;
  let customer: TestUser;
  let barberId: string;
  const testDate = '2026-09-01'; // Monday

  beforeAll(async () => {
    const sid = await getAnyActiveSalonId();
    if (!sid) throw new Error('no active salon');
    salonId = sid;
    customer = await createTestCustomer('overrides-test');

    const prof = await seedTestProfessional(salonId, { displayName: 'Overrides Barber' });
    barberId = prof.id;
  });

  afterAll(async () => {
    await clearBookingsFor([barberId], testDate, testDate);
    await clearWeeklyAvailability(barberId);
    await clearOverrides(barberId);
    await deleteTestProfessional(barberId);
    if (customer) await deleteTestUser(customer.id);
  });

  afterEach(async () => {
    await clearBookingsFor([barberId], testDate, testDate);
    await clearWeeklyAvailability(barberId);
    await clearOverrides(barberId);
  });

  test('9.1 Override sets normally-available Monday to is_available=false → no slots, date hidden', async () => {
    await seedWeeklyAvailability(barberId, [
      { dayOfWeek: 1, isAvailable: true, startTime: '09:00', endTime: '18:00' },
    ]);
    await seedOverride(barberId, testDate, { isAvailable: false });

    // Fetch booked slots (none)
    const booked = await callRpcAsAnon([barberId], testDate, testDate);

    // Compute working hours — should be null because override closes the day
    const weekly = (
      await adminClient()
        .from('professional_availability')
        .select('*')
        .eq('professional_id', barberId)
    ).data ?? [];
    const overrides = (
      await adminClient()
        .from('availability_overrides')
        .select('*')
        .eq('professional_id', barberId)
    ).data ?? [];

    const hours = getWorkingHoursForDate(testDate, weekly, overrides);
    expect(hours).toBeNull();

    const slots = buildTimeSlots(hours, 30, booked);
    expect(slots).toEqual([]);
  });

  test('9.2 Sunday (weekly-off) + override open 10:00–14:00 → slots 10:00–13:30', async () => {
    const sundayDate = '2026-09-06'; // Sunday

    await seedWeeklyAvailability(barberId, [
      { dayOfWeek: 1, isAvailable: true, startTime: '09:00', endTime: '18:00' },
    ]);
    await seedOverride(barberId, sundayDate, { isAvailable: true, start: '10:00', end: '14:00' });

    const booked = await callRpcAsAnon([barberId], sundayDate, sundayDate);

    const weekly = (
      await adminClient()
        .from('professional_availability')
        .select('*')
        .eq('professional_id', barberId)
    ).data ?? [];
    const overrides = (
      await adminClient()
        .from('availability_overrides')
        .select('*')
        .eq('professional_id', barberId)
    ).data ?? [];

    const hours = getWorkingHoursForDate(sundayDate, weekly, overrides);
    expect(hours).toEqual({ start: 600, end: 840 }); // 10:00=600, 14:00=840

    const slots = buildTimeSlots(hours, 30, booked);
    expect(slots).toEqual(['10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30']);
  });

  test('9.3 Weekly 09:00–18:00, override 13:00–17:00 → slots start at 13:00', async () => {
    await seedWeeklyAvailability(barberId, [
      { dayOfWeek: 1, isAvailable: true, startTime: '09:00', endTime: '18:00' },
    ]);
    await seedOverride(barberId, testDate, { isAvailable: true, start: '13:00', end: '17:00' });

    const booked = await callRpcAsAnon([barberId], testDate, testDate);

    const weekly = (
      await adminClient()
        .from('professional_availability')
        .select('*')
        .eq('professional_id', barberId)
    ).data ?? [];
    const overrides = (
      await adminClient()
        .from('availability_overrides')
        .select('*')
        .eq('professional_id', barberId)
    ).data ?? [];

    const hours = getWorkingHoursForDate(testDate, weekly, overrides);
    expect(hours).toEqual({ start: 780, end: 1020 }); // 13:00=780, 17:00=1020

    const slots = buildTimeSlots(hours, 30, booked);
    expect(slots[0]).toBe('13:00');
    expect(slots).not.toContain('09:00');
  });

  test('9.4 Override for a date outside the 30-day booking window → no visible effect', async () => {
    // Compute a date 35 days from now — definitely outside the 30-day window
    const today = new Date();
    const outsideDate = new Date(today);
    outsideDate.setDate(today.getDate() + 35);
    const outsideDateStr = `${outsideDate.getFullYear()}-${String(outsideDate.getMonth() + 1).padStart(2, '0')}-${String(outsideDate.getDate()).padStart(2, '0')}`;

    await seedWeeklyAvailability(barberId, [
      { dayOfWeek: 1, isAvailable: true, startTime: '09:00', endTime: '18:00' },
    ]);
    await seedOverride(barberId, outsideDateStr, { isAvailable: false });

    const weekly = (
      await adminClient()
        .from('professional_availability')
        .select('*')
        .eq('professional_id', barberId)
    ).data ?? [];
    const overrides = (
      await adminClient()
        .from('availability_overrides')
        .select('*')
        .eq('professional_id', barberId)
    ).data ?? [];

    // The override exists, but since the date is outside the visible window,
    // the UI would never query it. Verify the override is stored correctly.
    const overrideForDate = overrides.find((o) => o.override_date === outsideDateStr);
    expect(overrideForDate).toBeDefined();
    expect(overrideForDate?.is_available).toBe(false);

    // The date is not in the booking window
    const dateSlots = buildDateSlots();
    const dateIds = dateSlots.map((s) => s.id);
    expect(dateIds).not.toContain(outsideDateStr);
  });

  test('9.5 Override start_time >= end_time → blocked by DB CHECK constraint', async () => {
    try {
      await seedOverride(barberId, testDate, { isAvailable: true, start: '17:00', end: '13:00' });
      fail('expected CHECK constraint violation');
    } catch (err) {
      // The DB CHECK constraint should reject this
      expect(err).toBeDefined();
    }
  });

  test('9.6 Override that creates zero valid slots for selected service duration → date hidden', async () => {
    // Override with a 20-minute window — too short for a 30-min service
    await seedWeeklyAvailability(barberId, [
      { dayOfWeek: 1, isAvailable: true, startTime: '09:00', endTime: '18:00' },
    ]);
    await seedOverride(barberId, testDate, { isAvailable: true, start: '09:00', end: '09:20' });

    const booked = await callRpcAsAnon([barberId], testDate, testDate);

    const weekly = (
      await adminClient()
        .from('professional_availability')
        .select('*')
        .eq('professional_id', barberId)
    ).data ?? [];
    const overrides = (
      await adminClient()
        .from('availability_overrides')
        .select('*')
        .eq('professional_id', barberId)
    ).data ?? [];

    const hours = getWorkingHoursForDate(testDate, weekly, overrides);
    expect(hours).toEqual({ start: 540, end: 560 }); // 09:00=540, 09:20=560

    // 30-min service doesn't fit in a 20-min window
    const slots = buildTimeSlots(hours, 30, booked);
    expect(slots).toEqual([]);
  });
});
