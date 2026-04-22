import {
  buildCustomerAppointmentConfirmedMessage,
} from '@/lib/notifications/templates/customer/customer-appointment-confirmed';
import {
  buildCustomerAppointmentCancelledMessage,
} from '@/lib/notifications/templates/customer/customer-appointment-cancelled';
import { makeAppointmentFixture } from '../fixtures/appointment';

describe('buildCustomerAppointmentConfirmedMessage', () => {
  test('renders subject with date', async () => {
    const msg = await buildCustomerAppointmentConfirmedMessage(makeAppointmentFixture(), 'fr');
    expect(msg.subject).toContain('confirmé');
    expect(msg.subject).toContain('25');
  });

  test('renders plain text with customer first name', async () => {
    const msg = await buildCustomerAppointmentConfirmedMessage(makeAppointmentFixture(), 'fr');
    expect(msg.plainText).toContain('Bonjour Ali');
    expect(msg.plainText).toContain('confirmé');
    expect(msg.plainText).toContain('Classic haircut');
  });

  test('renders HTML with green accent', async () => {
    const msg = await buildCustomerAppointmentConfirmedMessage(makeAppointmentFixture(), 'fr');
    expect(msg.html).toContain('#22c55e');
    expect(msg.html).toContain('Bonjour Ali');
  });

  test('telegramHtml is empty', async () => {
    const msg = await buildCustomerAppointmentConfirmedMessage(makeAppointmentFixture(), 'fr');
    expect(msg.telegramHtml).toBe('');
  });

  test('whatsAppCloudParams is empty array', async () => {
    const msg = await buildCustomerAppointmentConfirmedMessage(makeAppointmentFixture(), 'fr');
    expect(msg.whatsAppCloudParams).toEqual([]);
  });
});

describe('buildCustomerAppointmentCancelledMessage', () => {
  test('renders subject with date', async () => {
    const msg = await buildCustomerAppointmentCancelledMessage(makeAppointmentFixture(), 'fr');
    expect(msg.subject).toContain('annulé');
    expect(msg.subject).toContain('25');
  });

  test('renders plain text with cancellation copy', async () => {
    const msg = await buildCustomerAppointmentCancelledMessage(makeAppointmentFixture(), 'fr');
    expect(msg.plainText).toContain('Bonjour Ali');
    expect(msg.plainText).toContain('annulé');
  });

  test('renders HTML with red accent', async () => {
    const msg = await buildCustomerAppointmentCancelledMessage(makeAppointmentFixture(), 'fr');
    expect(msg.html).toContain('#ef4444');
  });

  test('telegramHtml is empty', async () => {
    const msg = await buildCustomerAppointmentCancelledMessage(makeAppointmentFixture(), 'fr');
    expect(msg.telegramHtml).toBe('');
  });

  test('whatsAppCloudParams is empty array', async () => {
    const msg = await buildCustomerAppointmentCancelledMessage(makeAppointmentFixture(), 'fr');
    expect(msg.whatsAppCloudParams).toEqual([]);
  });
});
