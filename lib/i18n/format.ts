import type { Locale } from './config';

export function formatDate(d: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

export function formatTime(d: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: locale === 'en',
  }).format(d);
}

export function formatTimeFromHHMM(hhmm: string, locale: Locale): string {
  const [hours, minutes] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return formatTime(d, locale);
}

export function formatDateTime(d: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: locale === 'en',
  }).format(d);
}

export function formatMoney(n: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'en' ? 'en-MA' : 'fr-MA', {
    style: 'currency',
    currency: 'MAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatShortMonth(d: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'fr-FR', {
    month: 'short',
  }).format(d);
}

export function formatShortWeekday(d: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'fr-FR', {
    weekday: 'short',
  }).format(d);
}