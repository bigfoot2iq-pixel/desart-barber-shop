import { createClient } from '@/lib/supabase/client';
import type { PaymentSettings } from '@/lib/types/database';

export async function getPublicPaymentSettings() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('payment_settings')
    .select(
      'bank_transfer_enabled, account_holder, bank_name, rib, iban, swift_bic, payment_phone, instructions'
    )
    .single();

  if (error) throw error;
  return data as {
    bank_transfer_enabled: boolean;
    account_holder: string | null;
    bank_name: string | null;
    rib: string | null;
    iban: string | null;
    swift_bic: string | null;
    payment_phone: string | null;
    instructions: string | null;
  };
}

export async function updatePaymentSettings(
  patch: Partial<Omit<PaymentSettings, 'id' | 'created_at' | 'updated_at' | 'updated_by'>>
): Promise<PaymentSettings> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('payment_settings')
    .update(patch)
    .eq('singleton', true)
    .select()
    .single();

  if (error) {
    if ('code' in error && (error as { code?: string }).code === '42501') {
      throw new Error('You do not have permission to change payment settings.');
    }
    if ('code' in error && (error as { code?: string }).code === '23514') {
      throw new Error('Bank transfer requires account holder, bank name, and RIB.');
    }
    throw error;
  }

  return data as PaymentSettings;
}
