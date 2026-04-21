import { test as base, type BrowserContext, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  throw new Error(
    'NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SERVICE_ROLE_KEY are required for E2E tests.'
  );
}

export type TestUser = {
  id: string;
  email: string;
  password: string;
};

/**
 * Create a confirmed auth user via the admin API.
 * The DB trigger auto-creates their profile with role='customer'.
 */
async function createTestCustomer(label: string): Promise<TestUser> {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `e2e-${label}-${suffix}@desart-tests.invalid`;
  const password = `P@ss-${suffix}-${Math.random().toString(36).slice(2, 10)}`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`admin createUser failed: ${error?.message ?? 'no user returned'}`);
  }

  return { id: data.user.id, email, password };
}

async function deleteTestUser(userId: string): Promise<void> {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await admin.auth.admin.deleteUser(userId).catch(() => {});
}

/**
 * Sign in a user via the admin API and return the session tokens.
 */
async function getSessionTokens(email: string, password: string): Promise<{ accessToken: string; refreshToken: string }> {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: signInData, error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError || !signInData.session) {
    throw new Error(`signInWithPassword failed: ${signInError?.message ?? 'no session'}`);
  }

  return {
    accessToken: signInData.session.access_token,
    refreshToken: signInData.session.refresh_token,
  };
}

/**
 * Inject Supabase auth session into a Playwright browser context via localStorage.
 * Uses addInitScript so the session is queued on every new document before page scripts,
 * with access to localStorage on the real origin.
 */
async function injectAuthSession(context: BrowserContext, userId: string, accessToken: string, refreshToken: string): Promise<void> {
  const storageKey = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
  await context.addInitScript(
    ({ storageKey, userId, accessToken, refreshToken }) => {
      const data = {
        access_token: accessToken,
        refresh_token: refreshToken,
        user: {
          id: userId,
          aud: 'authenticated',
          role: 'authenticated',
          email: '',
          email_confirmed_at: new Date().toISOString(),
          phone: '',
          confirmed_at: new Date().toISOString(),
          last_sign_in_at: new Date().toISOString(),
          app_metadata: { provider: 'email', providers: ['email'], role: 'customer' },
          user_metadata: {},
          identities: [],
          created_at: new Date().toISOString(),
        },
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      };
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(data));
      } catch {
        // about:blank / opaque origin — ignore, real pages will take
      }
    },
    { storageKey, userId, accessToken, refreshToken }
  );
}

/**
 * Stub the signInWithGoogleModal function to bypass the Google OAuth popup.
 * Uses addInitScript to set the stubbed user ID before page scripts run.
 */
async function stubSignInWithGoogleModal(context: BrowserContext, userId: string): Promise<void> {
  await context.addInitScript(
    ({ userId }) => {
      (window as any).__e2e_stubbedUserId = userId;
    },
    { userId }
  );
}

type E2EFixtures = {
  /** Create a disposable test customer. Cleaned up automatically. */
  testCustomer: TestUser;
  /** A page with the test customer's auth session injected. */
  authenticatedPage: Page;
};

export const test = base.extend<E2EFixtures>({
  testCustomer: async ({}, use) => {
    const customer = await createTestCustomer('booking-time-step');
    try {
      await use(customer);
    } finally {
      await deleteTestUser(customer.id);
    }
  },

  authenticatedPage: async ({ testCustomer, context, page }, use) => {
    const tokens = await getSessionTokens(testCustomer.email, testCustomer.password);
    await injectAuthSession(context, testCustomer.id, tokens.accessToken, tokens.refreshToken);
    await stubSignInWithGoogleModal(context, testCustomer.id);
    await use(page);
  },
});

export { expect } from '@playwright/test';
export { createTestCustomer, deleteTestUser, getSessionTokens, injectAuthSession, stubSignInWithGoogleModal };
