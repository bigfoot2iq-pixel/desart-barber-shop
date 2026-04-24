import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { getRole } from '@/lib/roles';
import { getPendingAppointments } from '@/lib/queries';
import { hasLocale } from '@/lib/i18n/config';
import { localeHref } from '@/lib/i18n/href';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { DictionaryProvider } from '@/lib/i18n/client-dictionary';
import AdminShell from '../components/AdminShell';
import PaymentSettingsManager from '../components/PaymentSettingsManager';
import PaymentBankAccountsManager from '../components/PaymentBankAccountsManager';
import type { PaymentSettings, PaymentBankAccount } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

export default async function AdminPaymentPage({ params }: PageProps<'/[lang]'>) {
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

  const { data: settings, error: settingsError } = await supabase
    .from('payment_settings')
    .select('*')
    .eq('singleton', true)
    .single();

  if (settingsError || !settings) {
    throw new Error('Payment settings not found. Run migration 018+.');
  }

  const { data: accounts } = await supabase
    .from('payment_bank_accounts')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true });

  let pendingCount = 0;
  try {
    const pendingApts = await getPendingAppointments();
    pendingCount = pendingApts.length;
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
        section="payment"
        pendingCount={pendingCount}
        adminName={adminName}
        adminEmail={adminEmail}
      >
        <div className="max-w-7xl mx-auto flex flex-col gap-10 lg:grid lg:grid-cols-12">
          <div className="lg:col-span-4">
            <PaymentSettingsManager
              initialSettings={settings as PaymentSettings}
              initialAccounts={(accounts ?? []) as PaymentBankAccount[]}
            />
          </div>
          <div className="lg:col-span-8">
            <PaymentBankAccountsManager initialAccounts={(accounts ?? []) as PaymentBankAccount[]} />
          </div>
        </div>
      </AdminShell>
    </DictionaryProvider>
  );
}
