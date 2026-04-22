import { notFound } from 'next/navigation';
import type { Locale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { BookingExperience } from './_booking-experience';

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const locale = lang as Locale;

  if (!lang || (lang !== 'fr' && lang !== 'en')) {
    notFound();
  }

  const [common, booking, userPanel] = await Promise.all([
    getDictionary(locale, 'common'),
    getDictionary(locale, 'booking'),
    getDictionary(locale, 'userPanel'),
  ]);

  return <BookingExperience locale={locale} common={common} booking={booking} userPanel={userPanel} />;
}