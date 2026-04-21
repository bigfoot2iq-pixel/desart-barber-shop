import type { AppointmentWithDetails } from '@/lib/types/database';
import type { RenderedMessage } from '../../types';
import { formatDate, formatTime } from '../../types';

function buildPlainText(apt: AppointmentWithDetails): string {
  const firstName = apt.customer?.first_name ?? 'there';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';

  return [
    `Hi ${firstName},`,
    '',
    `We're sorry — your appointment on ${formatDate(apt.appointment_date)} at ${formatTime(apt.start_time)} has been cancelled.`,
    '',
    'If this was unexpected, please contact us. You can also book a new time any time.',
    ...(siteUrl ? [`Rebook: ${siteUrl}/book`] : []),
    '',
    '— DesArt Barber Shop',
  ].join('\n');
}

function buildHtml(apt: AppointmentWithDetails): string {
  const firstName = apt.customer?.first_name ?? 'there';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #f5f5f5;">
      <div style="background: #ffffff; border-radius: 8px; padding: 32px 24px; border: 1px solid #e0e0e0; border-left: 4px solid #ef4444;">
        <h2 style="margin: 0 0 8px; color: #1a1a1a; font-size: 22px;">Appointment cancelled</h2>
        <p style="margin: 0 0 24px; color: #555; font-size: 15px;">Hi ${firstName}, your appointment on <strong>${formatDate(apt.appointment_date)}</strong> at <strong>${formatTime(apt.start_time)}</strong> has been cancelled.</p>
        <p style="margin: 0 0 24px; color: #555; font-size: 14px;">If this was unexpected, please contact us. You can also book a new time any time.</p>
        ${siteUrl ? `<a href="${siteUrl}/book" style="display: inline-block; background: #ef4444; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 600;">Book a new appointment</a>` : ''}
        <p style="margin: 24px 0 0; color: #999; font-size: 13px;">— DesArt Barber Shop</p>
      </div>
    </div>
  `;
}

export function buildCustomerAppointmentCancelledMessage(apt: AppointmentWithDetails): RenderedMessage {
  return {
    subject: `Your appointment was cancelled — ${formatDate(apt.appointment_date)}`,
    plainText: buildPlainText(apt),
    html: buildHtml(apt),
    telegramHtml: '',
    whatsAppCloudParams: [],
  };
}
