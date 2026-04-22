import 'server-only';
import type { AppointmentWithDetails } from '@/lib/types/database';
import type { RenderedMessage } from '../../types';
import { formatDate, formatTime } from '../../types';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import type { Locale } from '@/lib/i18n/config';

function interpolate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? `{${key}}`);
}

export async function buildCustomerAppointmentCancelledMessage(
  apt: AppointmentWithDetails,
  locale: Locale,
): Promise<RenderedMessage> {
  const dict = await getDictionary(locale, 'notifications') as Record<string, unknown>;
  const cancelled = dict.cancelled as Record<string, string>;

  const firstName = apt.customer?.first_name ?? '';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';

  const dateStr = formatDate(apt.appointment_date, locale);
  const startTimeStr = formatTime(apt.start_time, locale);

  const interp = {
    name: firstName,
    date: dateStr,
  };

  const subject = interpolate(cancelled.subject, interp);
  const greeting = interpolate(cancelled.greeting, interp);

  const plainText = [
    greeting,
    '',
    `${cancelled.body} ${dateStr} ${cancelled.timeLabel}: ${startTimeStr}.`,
    '',
    locale === 'fr'
      ? 'Si cette annulation est inattendue, veuillez nous contacter. Vous pouvez également réserver un nouveau créneau à tout moment.'
      : 'If this was unexpected, please contact us. You can also book a new time any time.',
    ...(siteUrl ? [locale === 'fr' ? `Réserver : ${siteUrl}/book` : `Rebook: ${siteUrl}/book`] : []),
    '',
    cancelled.brand,
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #f5f5f5;">
      <div style="background: #ffffff; border-radius: 8px; padding: 32px 24px; border: 1px solid #e0e0e0; border-left: 4px solid #ef4444;">
        <h2 style="margin: 0 0 8px; color: #1a1a1a; font-size: 22px;">${locale === 'fr' ? 'Rendez-vous annulé' : 'Appointment cancelled'}</h2>
        <p style="margin: 0 0 24px; color: #555; font-size: 15px;">${greeting} ${cancelled.body} <strong>${dateStr}</strong> ${cancelled.timeLabel}: <strong>${startTimeStr}</strong>.</p>
        <p style="margin: 0 0 24px; color: #555; font-size: 14px;">${locale === 'fr' ? 'Si cette annulation est inattendue, veuillez nous contacter. Vous pouvez également réserver un nouveau créneau à tout moment.' : 'If this was unexpected, please contact us. You can also book a new time any time.'}</p>
        ${siteUrl ? `<a href="${siteUrl}/book" style="display: inline-block; background: #ef4444; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 600;">${locale === 'fr' ? 'Réserver un nouveau rendez-vous' : 'Book a new appointment'}</a>` : ''}
        <p style="margin: 24px 0 0; color: #999; font-size: 13px;">${cancelled.brand}</p>
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
