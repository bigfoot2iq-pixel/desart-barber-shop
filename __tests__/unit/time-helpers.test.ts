import { toMinutes, toHHMM, toHHMMSS } from '@/lib/booking/slots';

describe('toMinutes', () => {
  test('toMinutes("09:30") → 570', () => {
    expect(toMinutes('09:30')).toBe(570);
  });

  test('toMinutes("00:00") → 0', () => {
    expect(toMinutes('00:00')).toBe(0);
  });

  test('toMinutes("23:59") → 1439', () => {
    expect(toMinutes('23:59')).toBe(1439);
  });

  test('toMinutes("09:30:00") → 570 (ignores seconds)', () => {
    expect(toMinutes('09:30:00')).toBe(570);
  });
});

describe('toHHMM', () => {
  test('toHHMM(570) → "09:30"', () => {
    expect(toHHMM(570)).toBe('09:30');
  });

  test('toHHMM(0) → "00:00"', () => {
    expect(toHHMM(0)).toBe('00:00');
  });

  test('toHHMM(1410) → "23:30"', () => {
    expect(toHHMM(1410)).toBe('23:30');
  });
});

describe('toHHMMSS', () => {
  test('toHHMMSS("09:30") → "09:30:00"', () => {
    expect(toHHMMSS('09:30')).toBe('09:30:00');
  });

  test('toHHMMSS("00:00") → "00:00:00"', () => {
    expect(toHHMMSS('00:00')).toBe('00:00:00');
  });
});

describe('Round-trip', () => {
  test.each(['00:00', '09:00', '23:30'])('toHHMM(toMinutes("%s")) === "%s"', (input) => {
    expect(toHHMM(toMinutes(input))).toBe(input);
  });
});

describe('toMinutes("24:00")', () => {
  test('24:00 → 1440 (documented behaviour: no input validation, returns 1440)', () => {
    expect(toMinutes('24:00')).toBe(1440);
  });
});
