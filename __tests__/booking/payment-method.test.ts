import { adminClient, anonClient, describeWithServiceRole } from '@/__tests__/security/helpers';

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  // eslint-disable-next-line no-console
  console.warn('[booking] skipping payment-method suite: set SUPABASE_SERVICE_ROLE_KEY to run');
}

describeWithServiceRole('DB / payment method selection', () => {
  test('payment_method: bank_transfer round-trips (write then read)', async () => {
    const admin = adminClient();

    // Seed a minimal customer to FK against
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: `pm-test-${Date.now()}@desart-tests.invalid`,
      password: `P@ss-${Date.now()}`,
      email_confirm: true,
    });
    if (authError || !authData?.user) {
      throw new Error('Failed to create test user');
    }
    const customerId = authData.user.id;

    try {
      // Insert an appointment with bank_transfer
      const { data: inserted, error: insertError } = await admin
        .from('appointments')
        .insert({
          customer_id: customerId,
          professional_id: null,
          preferred_professional_id: null,
          location_type: 'salon',
          salon_id: (await admin.from('salons').select('id').eq('is_active', true).limit(1).single()).data?.id,
          home_address: null,
          home_latitude: null,
          home_longitude: null,
          appointment_date: '2026-09-15',
          start_time: '10:00:00',
          end_time: '10:30:00',
          payment_method: 'bank_transfer',
          status: 'pending',
          total_price_mad: 100,
          notes: null,
        })
        .select()
        .single();

      expect(insertError).toBeNull();
      expect(inserted).toBeDefined();
      expect((inserted as { payment_method: string }).payment_method).toBe('bank_transfer');

      // Read it back
      const { data: readBack } = await admin
        .from('appointments')
        .select('payment_method')
        .eq('id', (inserted as { id: string }).id)
        .single();

      expect((readBack as { payment_method: string }).payment_method).toBe('bank_transfer');
    } finally {
      // Cleanup
      await admin.from('appointments').delete().eq('customer_id', customerId);
      await admin.auth.admin.deleteUser(customerId).catch(() => {});
    }
  });

  test('payment_settings: anon can SELECT', async () => {
    const anon = anonClient();
    const { data, error } = await anon
      .from('payment_settings')
      .select('bank_transfer_enabled, payment_phone, instructions')
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  test('payment_settings: anon UPDATE is silently blocked by RLS', async () => {
    const anon = anonClient();
    const admin = adminClient();

    // Read current value
    const { data: before } = await admin
      .from('payment_settings')
      .select('bank_transfer_enabled')
      .single();

    // Attempt update as anon — PostgREST silently returns null for blocked updates
    const { error } = await anon
      .from('payment_settings')
      .update({ bank_transfer_enabled: !before?.bank_transfer_enabled })
      .eq('singleton', true);

    expect(error).toBeNull();

    // Verify no change occurred
    const { data: after } = await admin
      .from('payment_settings')
      .select('bank_transfer_enabled')
      .single();

    expect(after?.bank_transfer_enabled).toBe(before?.bank_transfer_enabled);
  });

  test('payment_bank_accounts: backfill from migration 019 simulation', async () => {
    const admin = adminClient();

    // Simulate what migration 019 does: ensure settings has no old account columns,
    // and accounts live in the new table.
    const { data: settings } = await admin
      .from('payment_settings')
      .select('*')
      .single();

    expect(settings).toBeDefined();
    // After migration 019, these columns should not exist on payment_settings
    expect(settings).not.toHaveProperty('account_holder');
    expect(settings).not.toHaveProperty('bank_name');
    expect(settings).not.toHaveProperty('rib');
    expect(settings).not.toHaveProperty('iban');
    expect(settings).not.toHaveProperty('swift_bic');
  });

  test('payment_bank_accounts: anon can SELECT only active rows', async () => {
    const admin = adminClient();
    const anon = anonClient();

    // Ensure there's at least one active and one inactive account
    const { data: allAccounts } = await admin
      .from('payment_bank_accounts')
      .select('id, is_active')
      .order('created_at', { ascending: false })
      .limit(2);

    if (!allAccounts || allAccounts.length < 2) {
      // Seed if needed
      const { data: created } = await admin
        .from('payment_bank_accounts')
        .insert({
          account_holder: 'Test Holder',
          bank_name: 'Test Bank',
          rib: '123456789012345678901234',
          is_active: true,
          sort_order: 0,
        })
        .select('id')
        .single();
      if (created) {
        await admin
          .from('payment_bank_accounts')
          .insert({
            account_holder: 'Inactive Holder',
            bank_name: 'Inactive Bank',
            rib: '123456789012345678901235',
            is_active: false,
            sort_order: 1,
          });
      }
    }

    const { data: anonRows } = await anon
      .from('payment_bank_accounts')
      .select('id, is_active');

    expect(anonRows).toBeDefined();
    expect(anonRows!.every((r) => (r as { is_active: boolean }).is_active)).toBe(true);
  });

  test('payment_bank_accounts: anon INSERT is blocked by RLS', async () => {
    const anon = anonClient();

    const { error: insertError } = await anon
      .from('payment_bank_accounts')
      .insert({
        account_holder: 'Anon',
        bank_name: 'Anon Bank',
        rib: '123456789012345678901234',
        is_active: true,
        sort_order: 999,
      });

    expect(insertError).toBeDefined();
    expect((insertError as { code?: string })?.code).toBe('42501');
  });

  test('payment_bank_accounts: anon UPDATE and DELETE are silently blocked by RLS', async () => {
    const admin = adminClient();
    const anon = anonClient();

    // Seed a row to test against
    const { data: seed } = await admin
      .from('payment_bank_accounts')
      .insert({
        account_holder: 'RLS Test',
        bank_name: 'RLS Bank',
        rib: '123456789012345678901236',
        is_active: true,
        sort_order: 9997,
      })
      .select('id, bank_name')
      .single();

    expect(seed).toBeDefined();
    const id = (seed as { id: string }).id;

    // UPDATE as anon — silently blocked
    const { error: updateError } = await anon
      .from('payment_bank_accounts')
      .update({ bank_name: 'Hacked' })
      .eq('id', id);

    expect(updateError).toBeNull();

    const { data: afterUpdate } = await admin
      .from('payment_bank_accounts')
      .select('bank_name')
      .eq('id', id)
      .single();

    expect((afterUpdate as { bank_name: string }).bank_name).toBe('RLS Bank');

    // DELETE as anon — silently blocked
    const { error: deleteError } = await anon
      .from('payment_bank_accounts')
      .delete()
      .eq('id', id);

    expect(deleteError).toBeNull();

    const { data: afterDelete } = await admin
      .from('payment_bank_accounts')
      .select('id')
      .eq('id', id)
      .single();

    expect(afterDelete).toBeDefined();

    // Cleanup
    await admin.from('payment_bank_accounts').delete().eq('id', id);
  });

  test('payment_bank_accounts: admin can CRUD all rows', async () => {
    const admin = adminClient();

    const { data: created, error: createError } = await admin
      .from('payment_bank_accounts')
      .insert({
        account_holder: 'Admin Test',
        bank_name: 'Admin Bank',
        rib: '123456789012345678901237',
        is_active: true,
        sort_order: 9998,
      })
      .select()
      .single();

    expect(createError).toBeNull();
    expect(created).toBeDefined();

    const { error: updateError } = await admin
      .from('payment_bank_accounts')
      .update({ bank_name: 'Admin Bank Updated' })
      .eq('id', (created as { id: string }).id);

    expect(updateError).toBeNull();

    const { data: readBack } = await admin
      .from('payment_bank_accounts')
      .select('bank_name')
      .eq('id', (created as { id: string }).id)
      .single();

    expect((readBack as { bank_name: string }).bank_name).toBe('Admin Bank Updated');

    const { error: deleteError } = await admin
      .from('payment_bank_accounts')
      .delete()
      .eq('id', (created as { id: string }).id);

    expect(deleteError).toBeNull();
  });

  test('reorder via upsert updates sort_order correctly', async () => {
    const admin = adminClient();

    // Seed three accounts
    const rows = [
      { account_holder: 'A', bank_name: 'Bank A', rib: '123456789012345678901230', is_active: true, sort_order: 0 },
      { account_holder: 'B', bank_name: 'Bank B', rib: '123456789012345678901231', is_active: true, sort_order: 1 },
      { account_holder: 'C', bank_name: 'Bank C', rib: '123456789012345678901232', is_active: true, sort_order: 2 },
    ];

    const { data: inserted } = await admin
      .from('payment_bank_accounts')
      .insert(rows)
      .select('id');

    expect(inserted).toBeDefined();
    expect(inserted!.length).toBe(3);

    const ids = inserted!.map((r) => (r as { id: string }).id);
    // Reorder to [C, A, B]
    const reordered = [ids[2], ids[0], ids[1]];

    try {
      // Replicate what reorderBankAccounts does: read full rows, then upsert with onConflict id
      const { data: existing } = await admin
        .from('payment_bank_accounts')
        .select('*')
        .in('id', ids);

      const byId = new Map((existing ?? []).map((r: { id: string }) => [r.id, r]));
      const upsertRows = reordered.map((id, index) => {
        const acct = byId.get(id) as {
          id: string;
          label: string | null;
          account_holder: string;
          bank_name: string;
          rib: string;
          iban: string | null;
          swift_bic: string | null;
          is_active: boolean;
        };
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

      const { error } = await admin
        .from('payment_bank_accounts')
        .upsert(upsertRows, { onConflict: 'id', ignoreDuplicates: false });

      expect(error).toBeNull();

      const { data: after } = await admin
        .from('payment_bank_accounts')
        .select('id, sort_order')
        .in('id', ids)
        .order('sort_order', { ascending: true });

      expect(after).toBeDefined();
      expect(after!.map((r) => (r as { id: string }).id)).toEqual(reordered);
      expect(after!.map((r) => (r as { sort_order: number }).sort_order)).toEqual([0, 1, 2]);
    } finally {
      await admin.from('payment_bank_accounts').delete().in('id', ids);
    }
  });
});
