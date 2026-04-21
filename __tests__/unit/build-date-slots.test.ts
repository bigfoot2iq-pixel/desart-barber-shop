import { buildDateSlots, BOOKING_WINDOW_DAYS } from '@/lib/booking/date-slots';

describe('buildDateSlots', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('returns BOOKING_WINDOW_DAYS entries', () => {
    jest.setSystemTime(new Date('2026-06-15T12:00:00'));
    const slots = buildDateSlots();
    expect(slots).toHaveLength(BOOKING_WINDOW_DAYS);
  });

  test('starts from tomorrow (i=1), today is NOT in the list', () => {
    jest.setSystemTime(new Date('2026-06-15T12:00:00'));
    const slots = buildDateSlots();
    expect(slots[0].id).toBe('2026-06-16');
    expect(slots.map((s) => s.id)).not.toContain('2026-06-15');
  });

  test('date IDs are in YYYY-MM-DD local-time format', () => {
    jest.setSystemTime(new Date('2026-06-15T12:00:00'));
    const slots = buildDateSlots();
    const dateIdRegex = /^\d{4}-\d{2}-\d{2}$/;
    slots.forEach((slot) => {
      expect(slot.id).toMatch(dateIdRegex);
    });
  });

  test('cross-month-boundary: anchor at 2026-01-25, verify Feb dates appear correctly', () => {
    jest.setSystemTime(new Date('2026-01-25T12:00:00'));
    const slots = buildDateSlots();
    expect(slots[0].id).toBe('2026-01-26');
    expect(slots[5].id).toBe('2026-01-31');
    expect(slots[6].id).toBe('2026-02-01');
    expect(slots[7].id).toBe('2026-02-02');
  });

  test('cross-year: anchor at 2026-12-20, verify 2027 dates appear', () => {
    jest.setSystemTime(new Date('2026-12-20T12:00:00'));
    const slots = buildDateSlots();
    expect(slots[0].id).toBe('2026-12-21');
    const jan2027Slots = slots.filter((s) => s.id.startsWith('2027-01'));
    expect(jan2027Slots.length).toBeGreaterThan(0);
    expect(jan2027Slots[0].id).toBe('2027-01-01');
  });

  test('leap-year: 2028-02-28 + 1 day = 2028-02-29', () => {
    jest.setSystemTime(new Date('2028-02-28T12:00:00'));
    const slots = buildDateSlots();
    expect(slots[0].id).toBe('2028-02-29');
    expect(slots[1].id).toBe('2028-03-01');
  });

  test('shortDay and displayDate are populated', () => {
    jest.setSystemTime(new Date('2026-06-15T12:00:00'));
    const slots = buildDateSlots();
    slots.forEach((slot) => {
      expect(slot.shortDay).toMatch(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/);
      expect(slot.displayDate).toMatch(/^\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/);
    });
  });
});
