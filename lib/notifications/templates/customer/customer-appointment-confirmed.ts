import type { AppointmentWithDetails } from '@/lib/types/database';
import type { RenderedMessage } from '../../types';
import { formatDate, formatTime } from '../../types';

function buildPlainText(apt: AppointmentWithDetails): string {
  const firstName = apt.customer?.first_name ?? 'there';
  const services = apt.services.map((s) => s.name).join(', ');
  const locationName = apt.location_type === 'home'
    ? (apt.home_address ?? 'Home visit')
    : (apt.salon?.name ?? 'Salon');

  return [
    `Hi ${firstName},`,
    '',
    'Good news — your appointment is confirmed.',
    '',
    `Date: ${formatDate(apt.appointment_date)}`,
    `Time: ${formatTime(apt.start_time)} – ${formatTime(apt.end_time)}`,
    `Services: ${services}`,
    `Location: ${locationName}`,
    `Payment: ${apt.payment_method.replace('_', ' ')} • ${apt.total_price_mad} MAD`,
    '',
    'See you soon!',
    '',
    '— DesArt Barber Shop',
  ].join('\n');
}

function buildHtml(apt: AppointmentWithDetails): string {
  const firstName = apt.customer?.first_name ?? 'there';
  const services = apt.services.map((s) => s.name).join(', ');
  const locationName = apt.location_type === 'home'
    ? (apt.home_address ?? 'Home visit')
    : (apt.salon?.name ?? 'Salon');

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #f5f5f5;">
      <div style="background: #ffffff; border-radius: 8px; padding: 32px 24px; border: 1px solid #e0e0e0; border-left: 4px solid #22c55e;">
        <h2 style="margin: 0 0 8px; color: #1a1a1a; font-size: 22px;">You're all set!</h2>
        <p style="margin: 0 0 24px; color: #555; font-size: 15px;">Hi ${firstName}, your appointment is confirmed.</p>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #333;">
          <tr><td style="padding: 8px 0; color: #888; width: 100px;">Date</td><td style="padding: 8px 0; font-weight: 600;">${formatDate(apt.appointment_date)}</td></tr>
          <tr><td style="padding: 8px 0; color: #888;">Time</td><td style="padding: 8px 0;">${formatTime(apt.start_time)} – ${formatTime(apt.end_time)}</td></tr>
          <tr><td style="padding: 8px 0; color: #888;">Services</td><td style="padding: 8px 0;">${services}</td></tr>
          <tr><td style="padding: 8px 0; color: #888;">Location</td><td style="padding: 8px 0;">${locationName}</td></tr>
          <tr><td style="padding: 8px 0; color: #888;">Payment</td><td style="padding: 8px 0;">${apt.payment_method.replace('_', ' ')} • ${apt.total_price_mad} MAD</td></tr>
        </table>
        <p style="margin: 24px 0 0; color: #555; font-size: 14px;">See you soon!</p>
        <p style="margin: 8px 0 0; color: #999; font-size: 13px;">— DesArt Barber Shop</p>
      </div>
    </div>
  `;
}

export function buildCustomerAppointmentConfirmedMessage(apt: AppointmentWithDetails): RenderedMessage {
  return {
    subject: `Your appointment is confirmed — ${formatDate(apt.appointment_date)}`,
    plainText: buildPlainText(apt),
    html: buildHtml(apt),
    telegramHtml: '',
    whatsAppCloudParams: [],
  };
}
