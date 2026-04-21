import {
  buildCustomerAppointmentConfirmedMessage,
} from '@/lib/notifications/templates/customer/customer-appointment-confirmed';
import {
  buildCustomerAppointmentCancelledMessage,
} from '@/lib/notifications/templates/customer/customer-appointment-cancelled';
import { makeAppointmentFixture } from '../fixtures/appointment';

describe('buildCustomerAppointmentConfirmedMessage', () => {
  test('renders subject with date', () => {
    const msg = buildCustomerAppointmentConfirmedMessage(makeAppointmentFixture());
    expect(msg.subject).toContain('confirmed');
    expect(msg.subject).toContain('Sat, Apr 25');
  });

  test('renders plain text with customer first name', () => {
    const msg = buildCustomerAppointmentConfirmedMessage(makeAppointmentFixture());
    expect(msg.plainText).toContain('Hi Ali');
    expect(msg.plainText).toContain('confirmed');
    expect(msg.plainText).toContain('Classic haircut, Beard trim');
  });

  test('renders HTML with green accent', () => {
    const msg = buildCustomerAppointmentConfirmedMessage(makeAppointmentFixture());
    expect(msg.html).toContain('#22c55e');
    expect(msg.html).toContain('Hi Ali');
  });

  test('telegramHtml is empty', () => {
    const msg = buildCustomerAppointmentConfirmedMessage(makeAppointmentFixture());
    expect(msg.telegramHtml).toBe('');
  });

  test('whatsAppCloudParams is empty array', () => {
    const msg = buildCustomerAppointmentConfirmedMessage(makeAppointmentFixture());
    expect(msg.whatsAppCloudParams).toEqual([]);
  });
});

describe('buildCustomerAppointmentCancelledMessage', () => {
  test('renders subject with date', () => {
    const msg = buildCustomerAppointmentCancelledMessage(makeAppointmentFixture());
    expect(msg.subject).toContain('cancelled');
    expect(msg.subject).toContain('Sat, Apr 25');
  });

  test('renders plain text with cancellation copy', () => {
    const msg = buildCustomerAppointmentCancelledMessage(makeAppointmentFixture());
    expect(msg.plainText).toContain('Hi Ali');
    expect(msg.plainText).toContain('cancelled');
  });

  test('renders HTML with red accent', () => {
    const msg = buildCustomerAppointmentCancelledMessage(makeAppointmentFixture());
    expect(msg.html).toContain('#ef4444');
  });

  test('telegramHtml is empty', () => {
    const msg = buildCustomerAppointmentCancelledMessage(makeAppointmentFixture());
    expect(msg.telegramHtml).toBe('');
  });

  test('whatsAppCloudParams is empty array', () => {
    const msg = buildCustomerAppointmentCancelledMessage(makeAppointmentFixture());
    expect(msg.whatsAppCloudParams).toEqual([]);
  });
});
