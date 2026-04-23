import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { getRole } from '@/lib/roles';
import { getAllProfessionals, getAllSalons, getPendingAppointments } from '@/lib/queries';
import type { Professional, Salon } from '@/lib/types/database';
import { hasLocale } from '@/lib/i18n/config';
import { localeHref } from '@/lib/i18n/href';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { DictionaryProvider } from '@/lib/i18n/client-dictionary';
import AdminShell from '../components/AdminShell';
import ProfessionalsManager from '../components/ProfessionalsManager';

export const dynamic = 'force-dynamic';

export default async function AdminProfessionalsPage({ params }: PageProps<'/[lang]'>) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(localeHref(lang, '/login'));
  }

  const role = getRole(user);

  if (role !== 'admin') {
    redirect(localeHref(lang, '/dashboard'));
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name, email')
    .eq('id', user.id)
    .single();

  const adminName = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Admin';
  const adminEmail = profile?.email || user.email || '';

  let pendingCount = 0;
  let professionals: (Professional & { salon: Salon | null })[] = [];
  let salons: Salon[] = [];
  try {
    const [pendingApts, profs, slns] = await Promise.all([
      getPendingAppointments(),
      getAllProfessionals(lang),
      getAllSalons(lang),
    ]);
    pendingCount = pendingApts.length;
    professionals = profs;
    salons = slns;
  } catch {
    // Will be loaded client-side
  }

  const [adminDict, commonDict] = await Promise.all([
    getDictionary(lang, 'admin'),
    getDictionary(lang, 'common'),
  ]);

  return (
    <DictionaryProvider value={{ admin: adminDict, common: commonDict }}>
      <AdminShell
        lang={lang}
        section="professionals"
        pendingCount={pendingCount}
        adminName={adminName}
        adminEmail={adminEmail}
      >
        <ProfessionalsManager lang={lang} initialProfessionals={professionals} initialSalons={salons} />
      </AdminShell>
    </DictionaryProvider>
  );
}
