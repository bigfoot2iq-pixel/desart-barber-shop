import { buildTimeSlots, toMinutes, type WorkingHours } from '@/lib/booking/slots';

const fullDay: WorkingHours = { start: toMinutes('09:00'), end: toMinutes('17:00') };

describe('buildTimeSlots', () => {
  test('1.1 hours=null returns []', () => {
    expect(buildTimeSlots(null, 30, [])).toEqual([]);
  });

  test('1.2 durationMin <= 0 returns []', () => {
    expect(buildTimeSlots(fullDay, 0, [])).toEqual([]);
    expect(buildTimeSlots(fullDay, -15, [])).toEqual([]);
  });

  test('1.3 Full empty day (09:00–17:00, 30 min) — 16 slots', () => {
    const slots = buildTimeSlots(fullDay, 30, []);
    expect(slots).toHaveLength(16);
    expect(slots[0]).toBe('09:00');
    expect(slots[slots.length - 1]).toBe('16:30');
  });

  test('1.4 Service duration > working window returns []', () => {
    const shortDay: WorkingHours = { start: toMinutes('09:00'), end: toMinutes('17:00') };
    const slots = buildTimeSlots(shortDay, 9 * 60, []);
    expect(slots).toEqual([]);
  });

  test('1.5 Service duration exactly equals window — one slot', () => {
    const slots = buildTimeSlots(fullDay, 8 * 60, []);
    expect(slots).toEqual(['09:00']);
  });

  test('1.6 Booking 09:00–09:30 with 30 min service — 09:00 hidden, 09:30 visible', () => {
    const slots = buildTimeSlots(fullDay, 30, [{ start_time: '09:00', end_time: '09:30' }]);
    expect(slots).not.toContain('09:00');
    expect(slots).toContain('09:30');
  });

  test('1.7 Booking 09:00–10:00 with 30 min service — 09:00 and 09:30 hidden, 10:00 visible', () => {
    const slots = buildTimeSlots(fullDay, 30, [{ start_time: '09:00', end_time: '10:00' }]);
    expect(slots).not.toContain('09:00');
    expect(slots).not.toContain('09:30');
    expect(slots).toContain('10:00');
  });

  test('1.8 Service of 60 min starting at 09:00 clashes with 09:30 booking — 09:00 hidden', () => {
    const slots = buildTimeSlots(fullDay, 60, [{ start_time: '09:30', end_time: '10:00' }]);
    expect(slots).not.toContain('09:00');
    expect(slots).toContain('10:00');
  });

  test('1.9 Back-to-back bookings 09:00–09:30 and 09:30–10:00 — 09:00, 09:30 hidden, 10:00 visible', () => {
    const slots = buildTimeSlots(fullDay, 30, [
      { start_time: '09:00', end_time: '09:30' },
      { start_time: '09:30', end_time: '10:00' },
    ]);
    expect(slots).not.toContain('09:00');
    expect(slots).not.toContain('09:30');
    expect(slots).toContain('10:00');
  });

  test('1.10 Booking ends exactly at hours.end — last slot correctly hidden', () => {
    const slots = buildTimeSlots(fullDay, 30, [{ start_time: '16:30', end_time: '17:00' }]);
    expect(slots).not.toContain('16:30');
  });

  test('1.11 Booking starts before hours.start — earliest slots that still fit are returned', () => {
    const slots = buildTimeSlots(fullDay, 30, [{ start_time: '08:00', end_time: '09:15' }]);
    expect(slots).not.toContain('09:00');
    expect(slots).toContain('09:30');
  });

  test('1.12 Multiple overlapping bookings — union of all blocked ranges is excluded', () => {
    const slots = buildTimeSlots(fullDay, 30, [
      { start_time: '09:00', end_time: '10:00' },
      { start_time: '11:00', end_time: '12:00' },
      { start_time: '14:00', end_time: '14:30' },
    ]);
    expect(slots).not.toContain('09:00');
    expect(slots).not.toContain('09:30');
    expect(slots).not.toContain('11:00');
    expect(slots).not.toContain('11:30');
    expect(slots).not.toContain('14:00');
    expect(slots).toContain('10:00');
    expect(slots).toContain('12:00');
    expect(slots).toContain('14:30');
  });

  test('1.13 SLOT_STEP_MINUTES=30, service duration 45 min — slots advance by 30 but each checks 45-min window', () => {
    const slots = buildTimeSlots(fullDay, 45, []);
    expect(slots[0]).toBe('09:00');
    expect(slots[1]).toBe('09:30');
    expect(slots[2]).toBe('10:00');
    const slotsWithBooking = buildTimeSlots(fullDay, 45, [{ start_time: '09:20', end_time: '09:50' }]);
    expect(slotsWithBooking).not.toContain('09:00');
    expect(slotsWithBooking).not.toContain('09:30');
    expect(slotsWithBooking).toContain('10:00');
  });

  test('1.14 Huge booking list (100+ entries) — still linear, no crash', () => {
    const bookings = Array.from({ length: 120 }, (_, i) => ({
      start_time: `09:${String(i % 60).padStart(2, '0')}`,
      end_time: `09:${String(Math.min(i % 60 + 15, 59)).padStart(2, '0')}`,
    }));
    expect(() => buildTimeSlots(fullDay, 30, bookings)).not.toThrow();
  });
});
