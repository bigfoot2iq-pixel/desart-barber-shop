import 'server-only';
import type { AppointmentWithDetails } from '@/lib/types/database';
import type { RenderedMessage } from '../../types';
import { formatDate, formatTime } from '../../types';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import type { Locale } from '@/lib/i18n/config';
import { localizeService, localizeSalon } from '@/lib/i18n/localize-row';

function interpolate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? `{${key}}`);
}

export async function buildCustomerAppointmentConfirmedMessage(
  apt: AppointmentWithDetails,
  locale: Locale,
): Promise<RenderedMessage> {
  const dict = await getDictionary(locale, 'notifications') as Record<string, unknown>;
  const confirmed = dict.confirmed as Record<string, string>;

  const firstName = apt.customer?.first_name ?? '';
  const services = apt.services.map((s) => localizeService(s, locale).name).join(', ');

  const localizedSalon = apt.salon ? localizeSalon(apt.salon, locale) : null;
  const locationName = apt.location_type === 'home'
    ? (apt.home_address ?? (dict.homeVisit as string))
    : localizedSalon?.name
    ?? (dict.homeVisit as string);

  const paymentLabel = apt.payment_method === 'bank_transfer'
    ? (dict.paymentBankTransfer as string)
    : (dict.paymentCash as string);

  const dateStr = formatDate(apt.appointment_date, locale);
  const startTimeStr = formatTime(apt.start_time, locale);
  const endTimeStr = formatTime(apt.end_time, locale);

  const interp = {
    name: firstName,
    date: dateStr,
  };

  const subject = interpolate(confirmed.subject, interp);
  const greeting = interpolate(confirmed.greeting, interp);

  const plainText = [
    greeting,
    '',
    confirmed.body,
    '',
    `${confirmed.dateLabel}: ${dateStr}`,
    `${confirmed.timeLabel}: ${startTimeStr} – ${endTimeStr}`,
    `${confirmed.servicesLabel}: ${services}`,
    `${confirmed.locationLabel}: ${locationName}`,
    `${confirmed.paymentLabel}: ${paymentLabel} • ${apt.total_price_mad} MAD`,
    '',
    confirmed.signoff,
    '',
    confirmed.brand,
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #f5f5f5;">
      <div style="background: #ffffff; border-radius: 8px; padding: 32px 24px; border: 1px solid #e0e0e0; border-left: 4px solid #22c55e;">
        <h2 style="margin: 0 0 8px; color: #1a1a1a; font-size: 22px;">${confirmed.heading}</h2>
        <p style="margin: 0 0 24px; color: #555; font-size: 15px;">${greeting} ${confirmed.body}</p>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #333;">
          <tr><td style="padding: 8px 0; color: #888; width: 100px;">${confirmed.dateLabel}</td><td style="padding: 8px 0; font-weight: 600;">${dateStr}</td></tr>
          <tr><td style="padding: 8px 0; color: #888;">${confirmed.timeLabel}</td><td style="padding: 8px 0;">${startTimeStr} – ${endTimeStr}</td></tr>
          <tr><td style="padding: 8px 0; color: #888;">${confirmed.servicesLabel}</td><td style="padding: 8px 0;">${services}</td></tr>
          <tr><td style="padding: 8px 0; color: #888;">${confirmed.locationLabel}</td><td style="padding: 8px 0;">${locationName}</td></tr>
          <tr><td style="padding: 8px 0; color: #888;">${confirmed.paymentLabel}</td><td style="padding: 8px 0;">${paymentLabel} • ${apt.total_price_mad} MAD</td></tr>
        </table>
        <p style="margin: 24px 0 0; color: #555; font-size: 14px;">${confirmed.signoff}</p>
        <p style="margin: 8px 0 0; color: #999; font-size: 13px;">${confirmed.brand}</p>
      </div>
    </div>
  `;

  return {
    subject,
    plainText,
    html,
    telegramHtml: '',
    whatsAppCloudParams: [],
  };
}
