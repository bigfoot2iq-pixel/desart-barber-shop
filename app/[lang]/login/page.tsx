import { notFound } from 'next/navigation';
import type { Locale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { DictionaryProvider } from '@/lib/i18n/client-dictionary';
import LoginForm from './_login-form';

export default async function LoginPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const locale = lang as Locale;

  if (!lang || (lang !== 'fr' && lang !== 'en')) {
    notFound();
  }

  const [common] = await Promise.all([
    getDictionary(locale, 'common'),
  ]);

  return (
    <DictionaryProvider value={{ common }}>
      <LoginForm />
    </DictionaryProvider>
  );
}