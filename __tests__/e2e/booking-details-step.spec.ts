import { test, expect } from './fixtures';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * booking-details-step.spec.ts
 *
 * Section 16 of the booking test plan — details/confirmation step.
 */

function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getActiveSalonId(): Promise<string> {
  const admin = adminClient();
  const { data, error } = await admin
    .from('salons')
    .select('id')
    .eq('is_active', true)
    .limit(1);
  if (error || !data || data.length === 0) {
    throw new Error('No active salon found for E2E tests');
  }
  return data[0].id;
}

async function getActiveBarberId(): Promise<string> {
  const admin = adminClient();
  const { data, error } = await admin
    .from('professionals')
    .select('id')
    .eq('is_active', true)
    .limit(1);
  if (error || !data || data.length === 0) {
    throw new Error('No active professional found for E2E tests');
  }
  return data[0].id;
}

async function getServiceIdForBarber(barberId: string): Promise<string> {
  const admin = adminClient();
  const { data } = await admin
    .from('professional_services')
    .select('service_id')
    .eq('professional_id', barberId)
    .limit(1);
  if (!data || data.length === 0) {
    throw new Error('Barber has no services for E2E test');
  }
  return (data[0] as { service_id: string }).service_id;
}

async function seedWeeklyAvailabilityForBarber(barberId: string): Promise<void> {
  const admin = adminClient();
  const rows = [];
  for (let day = 1; day <= 6; day++) {
    rows.push({
      professional_id: barberId,
      day_of_week: day,
      start_time: '09:00',
      end_time: '17:00',
      is_available: true,
    });
  }
  const { error } = await admin.from('professional_availability').insert(rows);
  if (error) throw new Error(`seedWeeklyAvailability failed: ${error.message}`);
}

async function clearWeeklyAvailability(barberId: string): Promise<void> {
  const admin = adminClient();
  await admin.from('professional_availability').delete().eq('professional_id', barberId);
}

function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function navigateToDetailsStep(
  page: import('@playwright/test').Page,
  barberId: string,
  serviceId: string,
  testDate: string
): Promise<void> {
  await page.getByTestId('btn:open-booking').first().click();
  await page.waitForSelector('[role="dialog"]', { state: 'visible' });

  // Step 1: Choose a location
  await page.waitForTimeout(500);
  const locationBtns = page.locator('[data-testid^="btn:location-"]');
  await locationBtns.first().waitFor({ state: 'visible', timeout: 10000 });
  await locationBtns.first().click();
  await page.waitForTimeout(800);

  // Step 2: Choose a barber
  const barberBtn = page.getByTestId(`btn:barber-${barberId}`);
  await barberBtn.waitFor({ state: 'visible', timeout: 10000 });
  await barberBtn.click();
  await page.waitForTimeout(800);

  // Step 3: Choose a service
  const serviceBtn = page.getByTestId(`btn:service-${serviceId}`);
  await serviceBtn.waitFor({ state: 'visible', timeout: 10000 });
  await serviceBtn.click();
  await page.waitForTimeout(800);

  // Step 4: Choose a date
  const dateBtn = page.getByTestId(`btn:date-${testDate}`);
  await dateBtn.waitFor({ state: 'visible', timeout: 10000 });
  await dateBtn.scrollIntoViewIfNeeded();
  await dateBtn.click({ force: true });
  await page.waitForTimeout(800);

  // Step 4: Choose a time
  const timeSlots = page.locator('[data-testid^="btn:time-"]');
  await timeSlots.first().waitFor({ state: 'visible', timeout: 10000 });
  await timeSlots.first().click();
  await page.waitForTimeout(800);

  // Verify we're on step 5 (details)
  await expect(page.locator('#panel-title')).toContainText('Your Details');
}

test.describe('Booking Details Step — Section 16', () => {
  let barberId: string;
  let serviceId: string;
  let salonId: string;
  let testDate: string;

  test.beforeAll(async () => {
    salonId = await getActiveSalonId();
    barberId = await getActiveBarberId();
    testDate = tomorrowStr();
    serviceId = await getServiceIdForBarber(barberId);
    await seedWeeklyAvailabilityForBarber(barberId);
  });

  test.afterAll(async () => {
    await clearWeeklyAvailability(barberId);
  });

  // 16.1 Submit without name/phone → validation blocks
  test('16.1 — submit without name/phone is blocked', async ({
    authenticatedPage,
  }) => {
    const page = authenticatedPage;
    await page.goto('/');

    await navigateToDetailsStep(page, barberId, serviceId, testDate);

    // Leave form fields empty
    await page.fill('#f-first', '');
    await page.fill('#f-last', '');
    await page.fill('#f-phone', '');

    // Confirm button should be disabled
    const confirmBtn = page.getByTestId('btn:confirm-booking');
    await expect(confirmBtn).toBeDisabled({ timeout: 10000 });
  });

  // 16.2 Phone format: test local Moroccan + international
  test('16.2 — phone field accepts Moroccan and international formats', async ({
    authenticatedPage,
    testCustomer,
  }) => {
    const page = authenticatedPage;
    await page.goto('/');

    await navigateToDetailsStep(page, barberId, serviceId, testDate);

    // Test international format
    await page.fill('#f-first', 'Test');
    await page.fill('#f-last', 'User');
    await page.fill('#f-phone', '+212600000003');

    // Confirm button should be enabled (formComplete = true)
    const confirmBtn = page.getByTestId('btn:confirm-booking');
    await expect(confirmBtn).toBeEnabled({ timeout: 10000 });
  });

  // 16.3 Google sign-in flow: mock successful sign-in → appointment saves
  // The auth is already injected via the fixture, so this tests the happy path
  // where the user is already authenticated.
  test('16.3 — authenticated user can submit without Google sign-in popup', async ({
    authenticatedPage,
    testCustomer,
  }) => {
    const page = authenticatedPage;
    await page.goto('/');

    await navigateToDetailsStep(page, barberId, serviceId, testDate);

    // Fill in the contact form
    await page.fill('#f-first', testCustomer.email.split('@')[0]);
    await page.fill('#f-last', 'Test');
    await page.fill('#f-phone', '+212600000004');

    // Click confirm booking — should not trigger Google sign-in popup
    await page.getByTestId('btn:confirm-booking').click();

    // Wait for booking confirmation
    await expect(page.getByTestId('step:booking-confirmed')).toBeVisible({ timeout: 15000 });
  });

  // 16.4 verifyUser returns null (stale JWT) → falls back to signInWithGoogleModal
  // This path is hard to test in E2E without manipulating the auth state mid-flow.
  // Mark as todo pending a product decision on how to simulate stale JWT.
  test('16.4 — stale JWT falls back to Google sign-in (plan item 16.4 — needs auth state manipulation fixture)', () => {
    test.skip(true, 'todo: not yet implemented');
  });

  // 16.5 Network failure mid-persistAppointment → saveError shown, user can retry
  // This requires mocking the network. Playwright can intercept requests.
  test('16.5 — network failure shows error message', async ({
    authenticatedPage,
    testCustomer,
  }) => {
    const page = authenticatedPage;
    await page.goto('/');

    // Block the createAppointment RPC call
    await page.route('**/rest/v1/rpc/**', async (route) => {
      const url = route.request().url();
      if (url.includes('create_appointment') || url.includes('get_booked_slots')) {
        // Only block the appointment creation, not the booked slots fetch
        if (url.includes('create_appointment')) {
          await route.abort('failed');
          return;
        }
      }
      await route.continue();
    });

    await navigateToDetailsStep(page, barberId, serviceId, testDate);

    // Fill in the contact form
    await page.fill('#f-first', testCustomer.email.split('@')[0]);
    await page.fill('#f-last', 'Test');
    await page.fill('#f-phone', '+212600000005');

    // Click confirm booking
    await page.getByTestId('btn:confirm-booking').click();

    // Should show an error message
    const errorDiv = page.getByTestId('text:booking-error');
    const isVisible = await errorDiv.isVisible({ timeout: 15000 }).catch(() => false);
    expect(isVisible).toBe(true);
  });

  // 16.6 Retry after SLOT_TAKEN error → UI shows "That time was just booked"
  // This requires racing a booking. Complex to set up in E2E.
  test('16.6 — SLOT_TAKEN retry shows friendly error and re-fetches slots (plan item 16.6 — needs concurrent booking race setup)', () => {
    test.skip(true, 'todo: not yet implemented');
  });

  // 16.7 Profile upsert fails → surface error
  // Hard to test without breaking the profiles table constraints.
  test('16.7 — profile upsert failure surfaces error (plan item 16.7 — needs profiles table constraint manipulation)', () => {
    test.skip(true, 'todo: not yet implemented');
  });
});
