import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getRole } from '@/lib/roles';
import { ToastProvider } from '../components/ui';
import PaymentSettingsManager from '../components/PaymentSettingsManager';
import type { PaymentSettings } from '@/lib/types/database';

export default async function AdminPaymentPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const role = getRole(user);

  if (role !== 'admin') {
    redirect('/dashboard');
  }

  const { data: settings, error } = await supabase
    .from('payment_settings')
    .select('*')
    .eq('singleton', true)
    .single();

  if (error || !settings) {
    throw new Error('Payment settings not found. Run migration 018.');
  }

  return (
    <ToastProvider>
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="font-playfair text-2xl text-foreground">Payment Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure bank transfer details shown during booking.
          </p>
        </div>
        <PaymentSettingsManager initialSettings={settings as PaymentSettings} />
      </div>
    </ToastProvider>
  );
}
