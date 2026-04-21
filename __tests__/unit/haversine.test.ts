import { haversineKm } from '@/lib/booking/slots';

describe('haversineKm', () => {
  test('Same point → 0', () => {
    expect(haversineKm(30.0, -5.0, 30.0, -5.0)).toBeCloseTo(0, 5);
  });

  test('Casablanca ↔ Agadir within 5% of ~398 km', () => {
    const casablanca = { lat: 33.5731, lon: -7.5898 };
    const agadir = { lat: 30.4278, lon: -9.5981 };
    const distance = haversineKm(casablanca.lat, casablanca.lon, agadir.lat, agadir.lon);
    expect(distance).toBeGreaterThan(398 * 0.95);
    expect(distance).toBeLessThan(398 * 1.05);
  });

  test('Antipodal → ~20000 km (sanity bound)', () => {
    const distance = haversineKm(0, 0, 0, 180);
    expect(distance).toBeGreaterThan(18000);
    expect(distance).toBeLessThan(22000);
  });

  test('North Pole ↔ South Pole → ~20000 km', () => {
    const distance = haversineKm(90, 0, -90, 0);
    expect(distance).toBeGreaterThan(19000);
    expect(distance).toBeLessThan(21000);
  });

  test('Short distance: ~1 km apart', () => {
    const distance = haversineKm(0, 0, 0.01, 0);
    expect(distance).toBeGreaterThan(0.5);
    expect(distance).toBeLessThan(1.5);
  });
});
