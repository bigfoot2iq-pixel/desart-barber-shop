import { notFound } from 'next/navigation';
import { hasLocale } from '@/lib/i18n/config';
import { BookingExperience } from './_booking-experience';

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();

  return <BookingExperience lang={lang} />;
}