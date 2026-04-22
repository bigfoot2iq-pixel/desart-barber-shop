import 'server-only';
import type { AppointmentWithDetails } from '@/lib/types/database';
import type { RenderedMessage } from '../types';
import { formatDate, formatTime, formatPhone } from '../types';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import type { Locale } from '@/lib/i18n/config';
import { localizeService, localizeSalon } from '@/lib/i18n/localize-row';

function interpolate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? `{${key}}`);
}

export async function buildAppointmentCancelledMessage(
  apt: AppointmentWithDetails,
  locale: Locale,
): Promise<RenderedMessage> {
  const dict = await getDictionary(locale, 'staffNotifications') as Record<string, unknown>;
  const cancelled = dict.cancelled as Record<string, string>;

  const customerName = `${apt.customer?.first_name ?? ''} ${apt.customer?.last_name ?? ''}`.trim();
  const services = apt.services.map((s) => localizeService(s, locale).name).join(', ');
  const locationType = apt.location_type === 'home'
    ? (dict.locationTypeHome as string)
    : (dict.locationTypeSalon as string);
  const localizedSalon = apt.salon ? localizeSalon(apt.salon, locale) : null;
  const locationName = apt.location_type === 'home'
    ? (apt.home_address ?? (dict.locationTypeHome as string))
    : (localizedSalon?.name ?? (dict.locationTypeSalon as string));

  const dateStr = formatDate(apt.appointment_date, locale);
  const startTimeStr = formatTime(apt.start_time, locale);
  const endTimeStr = formatTime(apt.end_time, locale);

  const interp = { customerName, date: dateStr, locationType };
  const subject = interpolate(cancelled.subject, interp);
  const heading = interpolate(cancelled.heading, interp);

  const plainText = [
    `❌ ${locationType} ${locale === 'fr' ? 'annulée' : 'cancelled'}`,
    `${dict.customerLabel as string}: ${customerName}`,
    `${dict.phoneLabel as string}: ${formatPhone(apt.customer?.phone)}`,
    `${dict.emailLabel as string}: ${apt.customer?.email ?? 'N/A'}`,
    `${dict.serviceLabel as string}: ${services}`,
    `${dict.dateLabel as string}: ${dateStr}`,
    `${dict.timeLabel as string}: ${startTimeStr} – ${endTimeStr}`,
    `${dict.locationLabel as string}: ${locationName}`,
    `${dict.paymentLabel as string}: ${apt.payment_method.replace('_', ' ')} • ${apt.total_price_mad} MAD`,
    ...(apt.notes ? [`${dict.notesLabel as string}: ${apt.notes}`] : []),
  ].join('\n');

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #f5f5f5;">
      <div style="background: #ffffff; border-radius: 8px; padding: 24px; border: 1px solid #e0e0e0; border-left: 4px solid #ef4444;">
        <h2 style="margin: 0 0 16px; color: #1a1a1a; font-size: 20px;">❌ ${heading}</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #333;">
          <tr><td style="padding: 6px 0; color: #888; width: 120px;">${dict.customerLabel as string}</td><td style="padding: 6px 0; font-weight: 600;">${customerName}</td></tr>
          <tr><td style="padding: 6px 0; color: #888;">${dict.phoneLabel as string}</td><td style="padding: 6px 0;">${formatPhone(apt.customer?.phone)}</td></tr>
          <tr><td style="padding: 6px 0; color: #888;">${dict.dateLabel as string}</td><td style="padding: 6px 0;">${dateStr}</td></tr>
          <tr><td style="padding: 6px 0; color: #888;">${dict.timeLabel as string}</td><td style="padding: 6px 0;">${startTimeStr} – ${endTimeStr}</td></tr>
          <tr><td style="padding: 6px 0; color: #888;">${dict.servicesLabel as string}</td><td style="padding: 6px 0;">${services}</td></tr>
          <tr><td style="padding: 6px 0; color: #888;">${dict.locationLabel as string}</td><td style="padding: 6px 0;">${locationName}</td></tr>
          <tr><td style="padding: 6px 0; color: #888;">${dict.paymentLabel as string}</td><td style="padding: 6px 0;">${apt.payment_method.replace('_', ' ')} • ${apt.total_price_mad} MAD</td></tr>
        </table>
        ${apt.notes ? `<div style="margin-top: 16px; padding: 12px; background: #f9f9f9; border-radius: 4px; font-size: 13px; color: #555;"><strong>${dict.notesLabel as string}:</strong> ${apt.notes}</div>` : ''}
      </div>
    </div>
  `;

  const telegramLines = [
    `<b>❌ ${locationType} ${locale === 'fr' ? 'annulée' : 'cancelled'}</b>`,
    `<b>${dict.customerLabel as string}:</b> ${customerName}`,
    `<b>${dict.phoneLabel as string}:</b> ${formatPhone(apt.customer?.phone)}`,
    `<b>${dict.emailLabel as string}:</b> ${apt.customer?.email ?? 'N/A'}`,
    `<b>${dict.serviceLabel as string}:</b> ${services}`,
    `<b>${dict.dateLabel as string}:</b> ${dateStr}`,
    `<b>${dict.timeLabel as string}:</b> ${startTimeStr} – ${endTimeStr}`,
    `<b>${dict.locationLabel as string}:</b> ${locationName}`,
    `<b>${dict.paymentLabel as string}:</b> ${apt.payment_method.replace('_', ' ')} • ${apt.total_price_mad} MAD`,
  ];
  if (apt.notes) {
    telegramLines.push(`<b>${dict.notesLabel as string}:</b> ${apt.notes}`);
  }

  return {
    subject,
    plainText,
    html,
    telegramHtml: telegramLines.join('\n'),
    whatsAppCloudParams: [
      customerName,
      dateStr,
      `${startTimeStr} – ${endTimeStr}`,
      services,
      locationType,
      `${apt.payment_method.replace('_', ' ')} • ${apt.total_price_mad} MAD`,
    ],
  };
}
