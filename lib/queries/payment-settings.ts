import { createClient } from '@/lib/supabase/client';
import type { PaymentSettings, PaymentBankAccount } from '@/lib/types/database';

// ------------------------------------------------------------------
// Public read
// ------------------------------------------------------------------

export async function getPublicPaymentConfig() {
  const supabase = createClient();
  const [settingsRes, accountsRes] = await Promise.all([
    supabase
      .from('payment_settings')
      .select('bank_transfer_enabled, payment_phone, instructions')
      .single(),
    supabase
      .from('payment_bank_accounts')
      .select('id, label, account_holder, bank_name, rib, iban, swift_bic, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true }),
  ]);

  if (settingsRes.error) throw settingsRes.error;
  if (accountsRes.error) throw accountsRes.error;

  return {
    bank_transfer_enabled: settingsRes.data.bank_transfer_enabled as boolean,
    payment_phone: settingsRes.data.payment_phone as string | null,
    instructions: settingsRes.data.instructions as string | null,
    accounts: (accountsRes.data ?? []) as Pick<
      PaymentBankAccount,
      'id' | 'label' | 'account_holder' | 'bank_name' | 'rib' | 'iban' | 'swift_bic' | 'sort_order'
    >[],
  };
}

// ------------------------------------------------------------------
// Admin-only: general settings
// ------------------------------------------------------------------

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
    throw error;
  }

  return data as PaymentSettings;
}

// ------------------------------------------------------------------
// Admin-only: bank accounts CRUD
// ------------------------------------------------------------------

export async function listBankAccounts(opts?: { includeInactive?: boolean }): Promise<PaymentBankAccount[]> {
  const supabase = createClient();
  let query = supabase
    .from('payment_bank_accounts')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true });

  if (!opts?.includeInactive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;
  if (error) {
    if ('code' in error && (error as { code?: string }).code === '42501') {
      throw new Error('You do not have permission to view bank accounts.');
    }
    throw error;
  }
  return (data ?? []) as PaymentBankAccount[];
}

export async function createBankAccount(
  input: Omit<PaymentBankAccount, 'id' | 'created_at' | 'updated_at' | 'sort_order'> & { sort_order?: number }
): Promise<PaymentBankAccount> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('payment_bank_accounts')
    .insert(input)
    .select()
    .single();

  if (error) {
    if ('code' in error && (error as { code?: string }).code === '42501') {
      throw new Error('You do not have permission to create bank accounts.');
    }
    throw error;
  }
  return data as PaymentBankAccount;
}

export async function updateBankAccount(
  id: string,
  patch: Partial<Omit<PaymentBankAccount, 'id' | 'created_at' | 'updated_at'>>
): Promise<PaymentBankAccount> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('payment_bank_accounts')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if ('code' in error && (error as { code?: string }).code === '42501') {
      throw new Error('You do not have permission to update bank accounts.');
    }
    throw error;
  }
  return data as PaymentBankAccount;
}

export async function deleteBankAccount(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('payment_bank_accounts')
    .delete()
    .eq('id', id);

  if (error) {
    if ('code' in error && (error as { code?: string }).code === '42501') {
      throw new Error('You do not have permission to delete bank accounts.');
    }
    throw error;
  }
}

// Reorder: accepts an ordered array of ids; writes sort_order = index for each.
export async function reorderBankAccounts(orderedIds: string[]): Promise<void> {
  const supabase = createClient();

  // Fetch full rows so the upsert INSERT branch satisfies NOT NULL constraints.
  const { data: existing, error: fetchError } = await supabase
    .from('payment_bank_accounts')
    .select('*')
    .in('id', orderedIds);

  if (fetchError) throw fetchError;

  const byId = new Map((existing ?? []).map((row) => [(row as { id: string }).id, row as PaymentBankAccount]));

  const rows = orderedIds.map((id, index) => {
    const acct = byId.get(id);
    if (!acct) throw new Error(`Bank account ${id} not found during reorder.`);
    return {
      id: acct.id,
      label: acct.label,
      account_holder: acct.account_holder,
      bank_name: acct.bank_name,
      rib: acct.rib,
      iban: acct.iban,
      swift_bic: acct.swift_bic,
      is_active: acct.is_active,
      sort_order: index,
    };
  });

  const { error } = await supabase
    .from('payment_bank_accounts')
    .upsert(rows, { onConflict: 'id', ignoreDuplicates: false });

  if (error) {
    if ('code' in error && (error as { code?: string }).code === '42501') {
      throw new Error('You do not have permission to reorder bank accounts.');
    }
    throw error;
  }
}
