import type { AppointmentWithDetails } from '@/lib/types/database';
import type { RenderedMessage } from '../types';
import { formatDate, formatTime, formatPhone } from '../types';

function buildPlainText(apt: AppointmentWithDetails): string {
  const customerName = `${apt.customer?.first_name ?? ''} ${apt.customer?.last_name ?? ''}`.trim();
  const services = apt.services.map((s) => s.name).join(', ');
  const locationType = apt.location_type === 'home' ? 'Come to Home' : 'Salon';
  const locationName = apt.location_type === 'home'
    ? (apt.home_address ?? 'Home visit')
    : (apt.salon?.name ?? 'Salon');

  return [
    `🏁 ${locationType} booking completed`,
    `Name: ${customerName}`,
    `Phone: ${formatPhone(apt.customer?.phone)}`,
    `Email: ${apt.customer?.email ?? 'N/A'}`,
    `Service: ${services}`,
    `Date: ${formatDate(apt.appointment_date)}`,
    `Time: ${formatTime(apt.start_time)} – ${formatTime(apt.end_time)}`,
    `Location: ${locationName}`,
    `Payment: ${apt.payment_method.replace('_', ' ')} • ${apt.total_price_mad} MAD`,
    ...(apt.notes ? [`Notes: ${apt.notes}`] : []),
  ].join('\n');
}

function buildHtml(apt: AppointmentWithDetails): string {
  const customerName = `${apt.customer?.first_name ?? ''} ${apt.customer?.last_name ?? ''}`.trim();
  const services = apt.services.map((s) => s.name).join(', ');
  const locationType = apt.location_type === 'home' ? 'Come to Home' : 'Salon';
  const locationName = apt.location_type === 'home'
    ? (apt.home_address ?? 'Home visit')
    : (apt.salon?.name ?? 'Salon');

  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #f5f5f5;">
      <div style="background: #ffffff; border-radius: 8px; padding: 24px; border: 1px solid #e0e0e0; border-left: 4px solid #3b82f6;">
        <h2 style="margin: 0 0 16px; color: #1a1a1a; font-size: 20px;">🏁 ${locationType} Booking Completed</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #333;">
          <tr><td style="padding: 6px 0; color: #888; width: 120px;">Customer</td><td style="padding: 6px 0; font-weight: 600;">${customerName}</td></tr>
          <tr><td style="padding: 6px 0; color: #888;">Phone</td><td style="padding: 6px 0;">${formatPhone(apt.customer?.phone)}</td></tr>
          <tr><td style="padding: 6px 0; color: #888;">Date</td><td style="padding: 6px 0;">${formatDate(apt.appointment_date)}</td></tr>
          <tr><td style="padding: 6px 0; color: #888;">Time</td><td style="padding: 6px 0;">${formatTime(apt.start_time)} – ${formatTime(apt.end_time)}</td></tr>
          <tr><td style="padding: 6px 0; color: #888;">Services</td><td style="padding: 6px 0;">${services}</td></tr>
          <tr><td style="padding: 6px 0; color: #888;">Location</td><td style="padding: 6px 0;">${locationName}</td></tr>
          <tr><td style="padding: 6px 0; color: #888;">Payment</td><td style="padding: 6px 0;">${apt.payment_method.replace('_', ' ')} • ${apt.total_price_mad} MAD</td></tr>
        </table>
        ${apt.notes ? `<div style="margin-top: 16px; padding: 12px; background: #f9f9f9; border-radius: 4px; font-size: 13px; color: #555;"><strong>Notes:</strong> ${apt.notes}</div>` : ''}
      </div>
    </div>
  `;
}

function buildTelegramHtml(apt: AppointmentWithDetails): string {
  const customerName = `${apt.customer?.first_name ?? ''} ${apt.customer?.last_name ?? ''}`.trim();
  const services = apt.services.map((s) => s.name).join(', ');
  const locationType = apt.location_type === 'home' ? 'Come to Home' : 'Salon';
  const locationName = apt.location_type === 'home'
    ? (apt.home_address ?? 'Home visit')
    : (apt.salon?.name ?? 'Salon');

  const lines = [
    `<b>🏁 ${locationType} booking completed</b>`,
    `<b>Name:</b> ${customerName}`,
    `<b>Phone:</b> ${formatPhone(apt.customer?.phone)}`,
    `<b>Email:</b> ${apt.customer?.email ?? 'N/A'}`,
    `<b>Service:</b> ${services}`,
    `<b>Date:</b> ${formatDate(apt.appointment_date)}`,
    `<b>Time:</b> ${formatTime(apt.start_time)} – ${formatTime(apt.end_time)}`,
    `<b>Location:</b> ${locationName}`,
    `<b>Payment:</b> ${apt.payment_method.replace('_', ' ')} • ${apt.total_price_mad} MAD`,
  ];

  if (apt.notes) {
    lines.push(`<b>Notes:</b> ${apt.notes}`);
  }

  return lines.join('\n');
}

export function buildAppointmentCompletedMessage(apt: AppointmentWithDetails): RenderedMessage {
  const customerName = `${apt.customer?.first_name ?? ''} ${apt.customer?.last_name ?? ''}`.trim();
  return {
    subject: `Booking completed — ${customerName} • ${formatDate(apt.appointment_date)}`,
    plainText: buildPlainText(apt),
    html: buildHtml(apt),
    telegramHtml: buildTelegramHtml(apt),
  };
}
