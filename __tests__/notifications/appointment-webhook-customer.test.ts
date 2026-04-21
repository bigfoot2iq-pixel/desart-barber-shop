import { NextRequest } from 'next/server';

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/notifications', () => ({
  dispatchEvent: jest.fn(),
}));

jest.mock('@/lib/notifications/customer-dispatch', () => ({
  dispatchCustomerEvent: jest.fn(),
}));

jest.mock('@/lib/notifications/queries', () => ({
  getAppointmentWithDetailsService: jest.fn(),
}));

import { createClient as createServerClient } from '@/lib/supabase/server';
import { dispatchEvent } from '@/lib/notifications';
import { dispatchCustomerEvent } from '@/lib/notifications/customer-dispatch';
import { getAppointmentWithDetailsService } from '@/lib/notifications/queries';

const mockSupabase = {
  auth: {
    getUser: jest.fn(),
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  (createServerClient as jest.Mock).mockResolvedValue(mockSupabase);
});

function makeRequest(body: Record<string, unknown>, secret?: string) {
  return new NextRequest('http://localhost/api/notifications/appointment-webhook', {
    method: 'POST',
    headers: {
      'x-webhook-secret': secret ?? 'test-secret',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

const handlerModule = require('@/app/api/notifications/appointment-webhook/route');

describe('appointment-webhook customer dispatch', () => {
  const webhookPayload = {
    type: 'UPDATE',
    table: 'appointments',
    schema: 'public',
    record: {
      id: 'apt-001',
      status: 'confirmed',
      customer_id: 'cust-001',
      updated_by: 'admin-001',
      updated_at: '2026-04-20T10:00:00Z',
    },
    old_record: {
      id: 'apt-001',
      status: 'pending',
      customer_id: 'cust-001',
      updated_by: 'cust-001',
    },
  };

  const mockAppointment = {
    id: 'apt-001',
    customer: { id: 'cust-001', first_name: 'Ali', last_name: 'Ben', email: 'ali@example.com', phone: '+212600000000' },
    services: [{ name: 'Classic haircut' }],
    salon: { name: 'Salon Downtown' },
  };

  beforeEach(() => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { app_metadata: { role: 'admin' } } } });
    (getAppointmentWithDetailsService as jest.Mock).mockResolvedValue(mockAppointment);
    (dispatchEvent as jest.Mock).mockResolvedValue([]);
  });

  test('updated_by != customer_id → customer dispatch is called', async () => {
    (dispatchCustomerEvent as jest.Mock).mockResolvedValue({ status: 'sent' });

    const req = makeRequest(webhookPayload, process.env.NOTIFICATIONS_WEBHOOK_SECRET);
    const res = await handlerModule.POST(req);
    const json = await res.json();

    expect(dispatchCustomerEvent).toHaveBeenCalled();
    expect(json.customerResults).toBeDefined();
  });

  test('updated_by == customer_id → customer dispatch is NOT called', async () => {
    const selfCancelPayload = {
      ...webhookPayload,
      record: {
        ...webhookPayload.record,
        status: 'cancelled',
        updated_by: 'cust-001',
      },
      old_record: {
        ...webhookPayload.old_record,
        status: 'confirmed',
      },
    };

    (dispatchCustomerEvent as jest.Mock).mockResolvedValue({ status: 'sent' });

    const req = makeRequest(selfCancelPayload, process.env.NOTIFICATIONS_WEBHOOK_SECRET);
    await handlerModule.POST(req);

    expect(dispatchCustomerEvent).not.toHaveBeenCalled();
  });

  test('updated_by null → customer dispatch is NOT called', async () => {
    const nullActorPayload = {
      ...webhookPayload,
      record: {
        ...webhookPayload.record,
        updated_by: null,
      },
    };

    (dispatchCustomerEvent as jest.Mock).mockResolvedValue({ status: 'sent' });

    const req = makeRequest(nullActorPayload, process.env.NOTIFICATIONS_WEBHOOK_SECRET);
    await handlerModule.POST(req);

    expect(dispatchCustomerEvent).not.toHaveBeenCalled();
  });

  test('event type outside CUSTOMER_EVENT_TYPES → customer dispatch is NOT called', async () => {
    const completedPayload = {
      ...webhookPayload,
      record: {
        ...webhookPayload.record,
        status: 'completed',
        updated_by: 'admin-001',
      },
      old_record: {
        ...webhookPayload.old_record,
        status: 'confirmed',
      },
    };

    (dispatchCustomerEvent as jest.Mock).mockResolvedValue({ status: 'sent' });

    const req = makeRequest(completedPayload, process.env.NOTIFICATIONS_WEBHOOK_SECRET);
    await handlerModule.POST(req);

    expect(dispatchCustomerEvent).not.toHaveBeenCalled();
  });
});
