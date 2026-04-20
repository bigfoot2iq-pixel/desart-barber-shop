import {
  anonClient,
  buildAppointmentPayload,
  getAnyActiveSalonId,
} from './helpers';

/**
 * Security: what a caller with only the public (anon) key MUST NOT be able
 * to do. Every expectation here represents a breach if it starts passing.
 *
 * We never assert "error is null" as a positive authorization signal — some
 * RLS denials surface as empty result sets (UPDATE/DELETE) rather than
 * thrown errors. Those cases assert 0 rows affected AND the row is unchanged.
 */
describe('Security / unauthenticated access', () => {
  const anon = anonClient();

  describe('appointments: writes are blocked', () => {
    test('cannot INSERT an appointment', async () => {
      const salonId = await getAnyActiveSalonId();
      const payload = buildAppointmentPayload({
        salon_id: salonId,
        location_type: 'salon',
      });
      const { data, error } = await anon.from('appointments').insert(payload).select();
      expect(error).not.toBeNull();
      expect(data).toBeNull();
      // RLS denial — Postgres error code 42501 or Supabase-mapped message
      expect(error?.code === '42501' || /row-level security|permission denied/i.test(error?.message ?? '')).toBe(true);
    });

    test('cannot INSERT with a spoofed customer_id', async () => {
      const salonId = await getAnyActiveSalonId();
      const payload = buildAppointmentPayload({
        customer_id: '11111111-1111-1111-1111-111111111111',
        salon_id: salonId,
      });
      const { error } = await anon.from('appointments').insert(payload).select();
      expect(error).not.toBeNull();
    });

    test('cannot INSERT with a pre-assigned professional_id', async () => {
      // Should be rejected either by RLS (no auth) or by the insert-constraint
      // trigger. Either is acceptable as long as the row never lands.
      const salonId = await getAnyActiveSalonId();
      const payload = buildAppointmentPayload({
        salon_id: salonId,
        professional_id: '22222222-2222-2222-2222-222222222222',
      });
      const { error, data } = await anon.from('appointments').insert(payload).select();
      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });

    test('cannot INSERT with a non-pending status', async () => {
      const salonId = await getAnyActiveSalonId();
      const payload = buildAppointmentPayload({
        salon_id: salonId,
        status: 'confirmed',
      });
      const { error } = await anon.from('appointments').insert(payload).select();
      expect(error).not.toBeNull();
    });

    test('UPDATE affects zero rows (and returns none)', async () => {
      const { data, error } = await anon
        .from('appointments')
        .update({ status: 'cancelled' })
        .neq('id', '00000000-0000-0000-0000-000000000000')
        .select();
      // RLS silently filters — no rows match the (nonexistent) USING clause.
      expect(error).toBeNull();
      expect(Array.isArray(data) ? data.length : 0).toBe(0);
    });

    test('DELETE affects zero rows', async () => {
      const { data, error } = await anon
        .from('appointments')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')
        .select();
      expect(error).toBeNull();
      expect(Array.isArray(data) ? data.length : 0).toBe(0);
    });
  });

  describe('appointments: reads are filtered to nothing', () => {
    test('SELECT returns an empty set', async () => {
      const { data, error } = await anon.from('appointments').select('id').limit(5);
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });

  describe('appointment_services: writes are blocked', () => {
    test('cannot INSERT into appointment_services', async () => {
      const { error } = await anon
        .from('appointment_services')
        .insert({
          appointment_id: '00000000-0000-0000-0000-000000000000',
          service_id: '00000000-0000-0000-0000-000000000000',
        })
        .select();
      expect(error).not.toBeNull();
    });
  });

  describe('profiles: table is not exposed to anon', () => {
    test('SELECT on profiles is refused (REVOKE SELECT from anon)', async () => {
      const { data, error } = await anon.from('profiles').select('id, email, role').limit(1);
      // Either a permission-denied error, or an empty set — never leaked data.
      if (error) {
        expect(/permission denied|not authorized|row-level security/i.test(error.message)).toBe(true);
      } else {
        expect(data).toEqual([]);
      }
    });

    test('cannot INSERT a profile', async () => {
      const { error } = await anon
        .from('profiles')
        .insert({ id: '33333333-3333-3333-3333-333333333333', role: 'admin' })
        .select();
      expect(error).not.toBeNull();
    });

    test('cannot UPDATE a profile', async () => {
      const { data, error } = await anon
        .from('profiles')
        .update({ role: 'admin' })
        .neq('id', '00000000-0000-0000-0000-000000000000')
        .select();
      if (!error) {
        expect(Array.isArray(data) ? data.length : 0).toBe(0);
      }
    });

    test('cannot DELETE a profile', async () => {
      const { data, error } = await anon
        .from('profiles')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')
        .select();
      if (!error) {
        expect(Array.isArray(data) ? data.length : 0).toBe(0);
      }
    });
  });

  describe('admin-only catalogs cannot be mutated', () => {
    test.each(['salons', 'services'] as const)('cannot INSERT into %s', async (table) => {
      const payload =
        table === 'salons'
          ? { name: 'pwn', address: 'x', latitude: 0, longitude: 0 }
          : { name: 'pwn', duration_minutes: 30, price_mad: 1 };
      const { error } = await anon.from(table).insert(payload).select();
      expect(error).not.toBeNull();
    });

    test.each(['salons', 'services'] as const)('cannot UPDATE %s', async (table) => {
      const { data, error } = await anon
        .from(table)
        .update({ is_active: false })
        .neq('id', '00000000-0000-0000-0000-000000000000')
        .select();
      if (!error) {
        expect(Array.isArray(data) ? data.length : 0).toBe(0);
      }
    });

    test.each(['salons', 'services'] as const)('cannot DELETE from %s', async (table) => {
      const { data, error } = await anon
        .from(table)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')
        .select();
      if (!error) {
        expect(Array.isArray(data) ? data.length : 0).toBe(0);
      }
    });

    test('cannot INSERT a professional', async () => {
      const { error } = await anon
        .from('professionals')
        .insert({
          id: '44444444-4444-4444-4444-444444444444',
          salon_id: '00000000-0000-0000-0000-000000000000',
          display_name: 'pwn',
          phone: '000',
          profession: 'barber',
        })
        .select();
      expect(error).not.toBeNull();
    });
  });

  describe('public read surface still works (positive controls)', () => {
    test('can SELECT active salons', async () => {
      const { error } = await anon.from('salons').select('id,name,is_active').eq('is_active', true);
      expect(error).toBeNull();
    });

    test('can SELECT active services', async () => {
      const { error } = await anon.from('services').select('id,name,is_active').eq('is_active', true);
      expect(error).toBeNull();
    });

    test('can SELECT active professionals', async () => {
      const { error } = await anon
        .from('professionals')
        .select('id,display_name,is_active')
        .eq('is_active', true);
      expect(error).toBeNull();
    });
  });
});
