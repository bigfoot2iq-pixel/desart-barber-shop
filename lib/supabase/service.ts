import { createClient as createSupabaseClient } from '@supabase/supabase-js';

let cachedClient: ReturnType<typeof createSupabaseClient> | null = null;

export function createServiceClient() {
  if (cachedClient) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  cachedClient = createSupabaseClient(url, key);
  return cachedClient;
}
