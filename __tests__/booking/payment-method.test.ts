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

  test('payment_settings: bank_transfer_enabled=false + missing RIB rejects at DB layer (23514)', async () => {
    const admin = adminClient();

    // First ensure bank_transfer is disabled
    await admin
      .from('payment_settings')
      .update({ bank_transfer_enabled: false, rib: null, account_holder: null, bank_name: null })
      .eq('singleton', true);

    // Try to enable bank_transfer without required fields — should fail
    const { error } = await admin
      .from('payment_settings')
      .update({ bank_transfer_enabled: true })
      .eq('singleton', true);

    expect(error).toBeDefined();
    expect((error as { code?: string })?.code).toBe('23514');
  });

  test('payment_settings: anon can SELECT', async () => {
    const anon = anonClient();
    const { data, error } = await anon
      .from('payment_settings')
      .select('bank_transfer_enabled, rib, account_holder, bank_name')
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  test('payment_settings: anon cannot UPDATE', async () => {
    const anon = anonClient();
    const { error } = await anon
      .from('payment_settings')
      .update({ bank_transfer_enabled: true })
      .eq('singleton', true);

    expect(error).toBeDefined();
    // RLS violation for anon
    expect((error as { code?: string })?.code).toBe('42501');
  });
});
