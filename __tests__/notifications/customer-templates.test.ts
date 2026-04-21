import {
  buildCustomerAppointmentConfirmedMessage,
} from '@/lib/notifications/templates/customer/customer-appointment-confirmed';
import {
  buildCustomerAppointmentCancelledMessage,
} from '@/lib/notifications/templates/customer/customer-appointment-cancelled';

function fixture(): Parameters<typeof buildCustomerAppointmentConfirmedMessage>[0] {
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
      { id: 'svc-002', name: 'Beard trim', duration_minutes: 15, price_mad: 80 },
    ],
  };
}

describe('buildCustomerAppointmentConfirmedMessage', () => {
  test('renders subject with date', () => {
    const msg = buildCustomerAppointmentConfirmedMessage(fixture());
    expect(msg.subject).toContain('confirmed');
    expect(msg.subject).toContain('Sat, Apr 25');
  });

  test('renders plain text with customer first name', () => {
    const msg = buildCustomerAppointmentConfirmedMessage(fixture());
    expect(msg.plainText).toContain('Hi Ali');
    expect(msg.plainText).toContain('confirmed');
    expect(msg.plainText).toContain('Classic haircut, Beard trim');
  });

  test('renders HTML with green accent', () => {
    const msg = buildCustomerAppointmentConfirmedMessage(fixture());
    expect(msg.html).toContain('#22c55e');
    expect(msg.html).toContain('Hi Ali');
  });

  test('telegramHtml is empty', () => {
    const msg = buildCustomerAppointmentConfirmedMessage(fixture());
    expect(msg.telegramHtml).toBe('');
  });

  test('whatsAppCloudParams is empty array', () => {
    const msg = buildCustomerAppointmentConfirmedMessage(fixture());
    expect(msg.whatsAppCloudParams).toEqual([]);
  });
});

describe('buildCustomerAppointmentCancelledMessage', () => {
  test('renders subject with date', () => {
    const msg = buildCustomerAppointmentCancelledMessage(fixture());
    expect(msg.subject).toContain('cancelled');
    expect(msg.subject).toContain('Sat, Apr 25');
  });

  test('renders plain text with cancellation copy', () => {
    const msg = buildCustomerAppointmentCancelledMessage(fixture());
    expect(msg.plainText).toContain('Hi Ali');
    expect(msg.plainText).toContain('cancelled');
  });

  test('renders HTML with red accent', () => {
    const msg = buildCustomerAppointmentCancelledMessage(fixture());
    expect(msg.html).toContain('#ef4444');
  });

  test('telegramHtml is empty', () => {
    const msg = buildCustomerAppointmentCancelledMessage(fixture());
    expect(msg.telegramHtml).toBe('');
  });

  test('whatsAppCloudParams is empty array', () => {
    const msg = buildCustomerAppointmentCancelledMessage(fixture());
    expect(msg.whatsAppCloudParams).toEqual([]);
  });
});
