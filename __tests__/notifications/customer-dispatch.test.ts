import { dispatchCustomerEvent } from '@/lib/notifications/customer-dispatch';

jest.mock('@/lib/supabase/service', () => ({
  createServiceClient: jest.fn(),
}));

jest.mock('@/lib/notifications/channels/email-resend', () => ({
  sendEmail: jest.fn(),
}));

import { createServiceClient } from '@/lib/supabase/service';
import { sendEmail } from '@/lib/notifications/channels/email-resend';

function fixture() {
  return {
    id: 'apt-001',
    customer_id: 'cust-001',
    appointment_date: '2026-04-25',
    start_time: '15:00:00',
    end_time: '15:45:00',
    status: 'confirmed',
    payment_method: 'cash',
    total_price_mad: 180,
    location_type: 'salon',
    home_address: null,
    notes: null,
    professional_id: null,
    preferred_professional_id: null,
    created_at: '2026-04-20T10:00:00Z',
    updated_at: '2026-04-20T10:00:00Z',
    updated_by: null,
    customer: {
      id: 'cust-001',
      first_name: 'Ali',
      last_name: 'Ben',
      email: 'ali@example.com',
      phone: '+212600000000',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    professional: null,
    preferred_professional: null,
    salon: { id: 'salon-001', name: 'Salon Downtown', address: '123 Main St', latitude: 0, longitude: 0 },
    services: [
      { id: 'svc-001', name: 'Classic haircut', duration_minutes: 30, price_mad: 100 },
    ],
  };
}

const settingsRow = {
  id: 'settings-001',
  is_enabled: true,
  resend_api_key: 're_testkey123',
  from_address: 'DesArt <no-reply@test.com>',
  events: ['appointment.confirmed', 'appointment.cancelled'],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

beforeEach(() => {
  jest.clearAllMocks();
});

function makeMockSupabase() {
  return {
    from: jest.fn(),
  };
}

function mockSettingsOnly(data: typeof settingsRow | null, error: unknown = null) {
  const supabase = makeMockSupabase();
  const chain = {
    select: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data, error }),
  };
  (supabase.from as jest.Mock).mockReturnValue(chain);
  return supabase;
}

function createDeliveryMock(
  insertResult: { data: unknown; error: unknown },
  updateResult: { error: unknown } = { error: null }
) {
  const insertChain = {
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(insertResult),
  };

  const updateChain = {
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue(updateResult),
  };

  let callIndex = 0;
  const fromMock = jest.fn().mockImplementation(() => {
    callIndex++;
    return callIndex <= 2 ? insertChain : updateChain;
  });

  return { fromMock, insertChain, updateChain };
}

describe('dispatchCustomerEvent', () => {
  test('settings disabled → returns null', async () => {
    const supabase = mockSettingsOnly({ ...settingsRow, is_enabled: false });
    (createServiceClient as jest.Mock).mockReturnValue(supabase);

    const result = await dispatchCustomerEvent('appointment.confirmed', fixture(), '2026-04-20T10:00:00Z');
    expect(result).toBeNull();
  });

  test('no settings row → returns null', async () => {
    const supabase = mockSettingsOnly(null);
    (createServiceClient as jest.Mock).mockReturnValue(supabase);

    const result = await dispatchCustomerEvent('appointment.confirmed', fixture(), '2026-04-20T10:00:00Z');
    expect(result).toBeNull();
  });

  test('event not in settings.events → returns null', async () => {
    const supabase = mockSettingsOnly({ ...settingsRow, events: ['appointment.confirmed'] });
    (createServiceClient as jest.Mock).mockReturnValue(supabase);

    const result = await dispatchCustomerEvent('appointment.cancelled', fixture(), '2026-04-20T10:00:00Z');
    expect(result).toBeNull();
  });

  test('customer email null → inserts failed row with no_customer_email', async () => {
    const supabase = makeMockSupabase();
    const settingsChain = {
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: settingsRow, error: null }),
    };
    const noEmailInsertChain = {
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
    };

    let callIndex = 0;
    (supabase.from as jest.Mock).mockImplementation(() => {
      callIndex++;
      return callIndex === 1 ? settingsChain : noEmailInsertChain;
    });
    (createServiceClient as jest.Mock).mockReturnValue(supabase);

    const apt = fixture();
    apt.customer = { ...apt.customer, email: null };

    const result = await dispatchCustomerEvent('appointment.confirmed', apt, '2026-04-20T10:00:00Z');
    expect(result).not.toBeNull();
    expect(result?.status).toBe('failed');
    expect(result?.error).toBe('no_customer_email');
  });

  test('customer email null, dedup collision → returns null', async () => {
    const supabase = makeMockSupabase();
    const settingsChain = {
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: settingsRow, error: null }),
    };
    const noEmailInsertChain = {
      insert: jest.fn().mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key' } }),
    };

    let callIndex = 0;
    (supabase.from as jest.Mock).mockImplementation(() => {
      callIndex++;
      return callIndex === 1 ? settingsChain : noEmailInsertChain;
    });
    (createServiceClient as jest.Mock).mockReturnValue(supabase);

    const apt = fixture();
    apt.customer = { ...apt.customer, email: null };

    const result = await dispatchCustomerEvent('appointment.confirmed', apt, '2026-04-20T10:00:00Z');
    expect(result).toBeNull();
  });

  test('happy path → inserts pending then updates to sent', async () => {
    const { fromMock } = createDeliveryMock({ data: { id: 'del-001' }, error: null });
    const settingsChain = {
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: settingsRow, error: null }),
    };

    let callIndex = 0;
    fromMock.mockImplementation(() => {
      callIndex++;
      return callIndex === 1 ? settingsChain : fromMock.mock.results[callIndex - 2]?.value;
    });

    const supabase = makeMockSupabase();
    const insertChain = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: 'del-001' }, error: null }),
    };
    const updateChain = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: null }),
    };

    callIndex = 0;
    (supabase.from as jest.Mock).mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) return settingsChain;
      if (callIndex === 2) return insertChain;
      return updateChain;
    });
    (createServiceClient as jest.Mock).mockReturnValue(supabase);
    (sendEmail as jest.Mock).mockResolvedValue(undefined);

    const result = await dispatchCustomerEvent('appointment.confirmed', fixture(), '2026-04-20T10:00:00Z');
    expect(result).not.toBeNull();
    expect(result?.status).toBe('sent');
    expect(sendEmail).toHaveBeenCalled();
  });

  test('resend throws → updates to failed with last_error', async () => {
    const supabase = makeMockSupabase();
    const settingsChain = {
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: settingsRow, error: null }),
    };
    const insertChain = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: 'del-001' }, error: null }),
    };
    const updateChain = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: null }),
    };

    let callIndex = 0;
    (supabase.from as jest.Mock).mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) return settingsChain;
      if (callIndex === 2) return insertChain;
      return updateChain;
    });
    (createServiceClient as jest.Mock).mockReturnValue(supabase);
    (sendEmail as jest.Mock).mockRejectedValue(new Error('rate_limited'));

    const result = await dispatchCustomerEvent('appointment.confirmed', fixture(), '2026-04-20T10:00:00Z');
    expect(result).not.toBeNull();
    expect(result?.status).toBe('failed');
    expect(result?.error).toBe('rate_limited');
  });

  test('dedup collision (23505) → returns null', async () => {
    const supabase = makeMockSupabase();
    const settingsChain = {
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: settingsRow, error: null }),
    };
    const insertChain = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key' } }),
    };

    let callIndex = 0;
    (supabase.from as jest.Mock).mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) return settingsChain;
      return insertChain;
    });
    (createServiceClient as jest.Mock).mockReturnValue(supabase);

    const result = await dispatchCustomerEvent('appointment.confirmed', fixture(), '2026-04-20T10:00:00Z');
    expect(result).toBeNull();
  });
});
