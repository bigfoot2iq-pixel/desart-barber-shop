import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { getRole } from '@/lib/roles';
import { ToastProvider } from '../components/ui';
import PaymentSettingsManager from '../components/PaymentSettingsManager';
import PaymentBankAccountsManager from '../components/PaymentBankAccountsManager';
import { hasLocale } from '@/lib/i18n/config';
import { localeHref } from '@/lib/i18n/href';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import type { PaymentSettings, PaymentBankAccount } from '@/lib/types/database';
import { DictionaryProvider } from '@/lib/i18n/client-dictionary';

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

  const [adminDict, commonDict] = await Promise.all([
    getDictionary(lang, 'admin'),
    getDictionary(lang, 'common'),
  ]);

  return (
    <DictionaryProvider value={{ admin: adminDict, common: commonDict }}>
      <ToastProvider>
        <div className="max-w-2xl mx-auto py-8 px-4 space-y-10">
          <PaymentSettingsManager
            initialSettings={settings as PaymentSettings}
            initialAccounts={(accounts ?? []) as PaymentBankAccount[]}
          />
          <PaymentBankAccountsManager initialAccounts={(accounts ?? []) as PaymentBankAccount[]} />
        </div>
      </ToastProvider>
    </DictionaryProvider>
  );
}
