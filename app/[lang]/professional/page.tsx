import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { getRole } from '@/lib/roles';
import { hasLocale } from '@/lib/i18n/config';
import { localeHref } from '@/lib/i18n/href';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import ProfessionalClient from './ProfessionalClient';

export const dynamic = 'force-dynamic';

export default async function ProfessionalPage({ params }: PageProps<'/[lang]'>) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();

  const [dict, common] = await Promise.all([
    getDictionary(lang, 'dashboard'),
    getDictionary(lang, 'common'),
  ]);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(localeHref(lang, '/login'));
  }

  const role = getRole(user);

  if (role !== 'professional') {
    redirect(localeHref(lang, '/dashboard'));
  }

  return <ProfessionalClient dict={dict} common={common} user={user} lang={lang} />;
}
