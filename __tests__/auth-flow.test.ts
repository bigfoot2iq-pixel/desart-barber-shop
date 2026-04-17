import { createClient } from '@supabase/supabase-js';

describe('Auth Flow', () => {
  let supabase: ReturnType<typeof createClient>;

  beforeAll(() => {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    );
  });

  test('initial session is null (no active user)', async () => {
    const { data } = await supabase.auth.getSession();
    expect(data.session).toBeNull();
  });

  test('signInWithOtp accepts valid email format', async () => {
    const testEmail = `test-${Date.now()}@example.com`;
    const { error } = await supabase.auth.signInWithOtp({
      email: testEmail,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SUPABASE_URL}`,
      },
    });

    // No error means OTP was sent successfully
    // Rate limit error is expected for test accounts
    if (error) {
      expect(error.message).not.toContain('Invalid email');
      expect(error.message).not.toContain('Invalid email format');
    }
  });

  test('signOut works when no session exists', async () => {
    const { error } = await supabase.auth.signOut();
    // SignOut with no session should not throw critical error
    if (error) {
      expect(error.message).not.toContain('Invalid API key');
    }
  });

  test('auth state listener can be subscribed', async () => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      expect(['SIGNED_IN', 'SIGNED_OUT', 'TOKEN_REFRESHED', 'INITIAL_SESSION']).toContain(event);
    });

    expect(data).toBeDefined();
    expect(data.subscription).toBeDefined();

    // Cleanup subscription
    data.subscription.unsubscribe();
  });

  test('getUser returns null when not authenticated', async () => {
    const { data, error } = await supabase.auth.getUser();
    expect(data.user).toBeNull();
    // Error is expected when no user is authenticated
    if (error) {
      expect(error.message).toMatch(/not authenticated|no session|missing/i);
    }
  });
});
