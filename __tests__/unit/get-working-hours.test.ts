import { getWorkingHoursForDate, toMinutes } from '@/lib/booking/slots';

const weeklyMon = [
  { day_of_week: 1, is_available: true, start_time: '09:00', end_time: '18:00' },
];

describe('getWorkingHoursForDate', () => {
  test('2.1 No override + weekly row for Monday — returns weekly Monday hours', () => {
    const result = getWorkingHoursForDate('2026-06-15', weeklyMon, []);
    expect(result).toEqual({ start: toMinutes('09:00'), end: toMinutes('18:00') });
  });

  test('2.2 No override + weekly row with is_available=false — null', () => {
    const weeklyOff = [
      { day_of_week: 1, is_available: false, start_time: '09:00', end_time: '18:00' },
    ];
    expect(getWorkingHoursForDate('2026-06-15', weeklyOff, [])).toBeNull();
  });

  test('2.3 No override + weekly missing (barber off that weekday) — null', () => {
    const weeklyTue = [
      { day_of_week: 2, is_available: true, start_time: '09:00', end_time: '18:00' },
    ];
    expect(getWorkingHoursForDate('2026-06-15', weeklyTue, [])).toBeNull();
  });

  test('2.4 Override with is_available=false — null even if weekly says open', () => {
    const overrides = [
      { override_date: '2026-06-15', is_available: false, start_time: null, end_time: null },
    ];
    expect(getWorkingHoursForDate('2026-06-15', weeklyMon, overrides)).toBeNull();
  });

  test('2.5 Override with shorter hours (13:00–17:00) on a normally 09:00–18:00 day — returns 13:00–17:00', () => {
    const overrides = [
      { override_date: '2026-06-15', is_available: true, start_time: '13:00', end_time: '17:00' },
    ];
    const result = getWorkingHoursForDate('2026-06-15', weeklyMon, overrides);
    expect(result).toEqual({ start: toMinutes('13:00'), end: toMinutes('17:00') });
  });

  test('2.6 Override with is_available=true on a weekly-off day (one-off opening) — returns override hours', () => {
    const weeklySunOff: typeof weeklyMon = [];
    const overrides = [
      { override_date: '2026-06-14', is_available: true, start_time: '10:00', end_time: '14:00' },
    ];
    const result = getWorkingHoursForDate('2026-06-14', weeklySunOff, overrides);
    expect(result).toEqual({ start: toMinutes('10:00'), end: toMinutes('14:00') });
  });

  test('2.7 Override with start_time=null, end_time=null, is_available=true — returns null', () => {
    const overrides = [
      { override_date: '2026-06-15', is_available: true, start_time: null, end_time: null },
    ];
    expect(getWorkingHoursForDate('2026-06-15', weeklyMon, overrides)).toBeNull();
  });

  describe('2.8 DST anchor days', () => {
    const weeklyAll = [
      { day_of_week: 0, is_available: true, start_time: '09:00', end_time: '18:00' },
      { day_of_week: 1, is_available: true, start_time: '09:00', end_time: '18:00' },
      { day_of_week: 2, is_available: true, start_time: '09:00', end_time: '18:00' },
      { day_of_week: 3, is_available: true, start_time: '09:00', end_time: '18:00' },
      { day_of_week: 4, is_available: true, start_time: '09:00', end_time: '18:00' },
      { day_of_week: 5, is_available: true, start_time: '09:00', end_time: '18:00' },
      { day_of_week: 6, is_available: true, start_time: '09:00', end_time: '18:00' },
    ];

    test('2026-03-29 (spring-forward) — correct weekday, hours returned', () => {
      const result = getWorkingHoursForDate('2026-03-29', weeklyAll, []);
      const dow = new Date('2026-03-29T12:00:00').getDay();
      const expected = weeklyAll.find((w) => w.day_of_week === dow);
      expect(result).toEqual({ start: toMinutes(expected!.start_time), end: toMinutes(expected!.end_time) });
    });

    test('2026-10-25 (fall-back) — correct weekday, hours returned', () => {
      const result = getWorkingHoursForDate('2026-10-25', weeklyAll, []);
      const dow = new Date('2026-10-25T12:00:00').getDay();
      const expected = weeklyAll.find((w) => w.day_of_week === dow);
      expect(result).toEqual({ start: toMinutes(expected!.start_time), end: toMinutes(expected!.end_time) });
    });
  });
});
