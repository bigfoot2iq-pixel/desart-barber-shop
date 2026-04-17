import { createClient } from '@supabase/supabase-js';

describe('Supabase Connection', () => {
  let supabase: ReturnType<typeof createClient>;

  beforeAll(() => {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    );
  });

  test('environment variables are set', () => {
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBeDefined();
    expect(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBeDefined();
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toContain('supabase.co');
    expect(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toContain('sb_publishable_');
  });

  test('client creates successfully', () => {
    expect(supabase).toBeDefined();
    expect(supabase.auth).toBeDefined();
    expect(supabase.from).toBeDefined();
  });

  test('can reach Supabase health endpoint', async () => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!}`,
      },
    });
    // 200 means success, 401 means key is invalid
    expect([200, 401]).toContain(response.status);
  });

  test('publishable key is valid', async () => {
    const { error } = await supabase.from('_dummy_table').select().limit(1);
    // If key is invalid, error will be about authentication
    // If key is valid but table doesn't exist, error will be about relation
    expect(error?.message).not.toContain('Invalid API key');
    expect(error?.message).not.toContain('Unauthorized');
  });
});
