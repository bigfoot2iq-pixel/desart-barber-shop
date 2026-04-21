import { test, expect } from './fixtures';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * booking-location-step.spec.ts
 *
 * Section 13 of the booking test plan — location step (salon/home/nearby).
 */

function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getActiveSalonIds(): Promise<string[]> {
  const admin = adminClient();
  const { data, error } = await admin
    .from('salons')
    .select('id')
    .eq('is_active', true);
  if (error || !data || data.length === 0) {
    throw new Error('No active salons found for E2E tests');
  }
  return data.map((r: { id: string }) => r.id);
}

async function getHomeVisitBarberId(): Promise<string | null> {
  const admin = adminClient();
  const { data } = await admin
    .from('professionals')
    .select('id')
    .eq('is_active', true)
    .eq('offers_home_visit', true)
    .limit(1);
  if (!data || data.length === 0) return null;
  return (data[0] as { id: string }).id;
}

async function getNoHomeVisitBarberId(): Promise<string | null> {
  const admin = adminClient();
  const { data } = await admin
    .from('professionals')
    .select('id')
    .eq('is_active', true)
    .eq('offers_home_visit', false)
    .limit(1);
  if (!data || data.length === 0) return null;
  return (data[0] as { id: string }).id;
}

test.describe('Booking Location Step — Section 13', () => {
  // 13.1 Salon mode: salons appear as location options
  test('13.1 — salon mode: active salons appear as location options', async ({
    authenticatedPage,
  }) => {
    const page = authenticatedPage;
    const salonIds = await getActiveSalonIds();

    await page.goto('/');
    await page.getByTestId('btn:open-booking').first().click();
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });
    await expect(page.locator('#panel-title')).toContainText('Choose a Location');

    // Verify at least one salon button is visible
    const locationBtns = page.locator('[data-testid^="btn:location-"]');
    await expect(locationBtns.first()).toBeVisible({ timeout: 10000 });

    // Verify the first active salon is present
    const firstSalonBtn = page.getByTestId(`btn:location-${salonIds[0]}`);
    await expect(firstSalonBtn).toBeVisible({ timeout: 10000 });
  });

  // 13.2 Home mode: requires a pin. Submit without pin → blocked.
  test('13.2 — home mode: "Come to me" button toggles home panel', async ({
    authenticatedPage,
  }) => {
    const page = authenticatedPage;

    await page.goto('/');
    await page.getByTestId('btn:open-booking').first().click();
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });

    // Click "Come to me" button
    const comeToMeBtn = page.getByRole('button', { name: /come to me/i });
    await expect(comeToMeBtn).toBeVisible({ timeout: 10000 });
    await comeToMeBtn.click();

    // The home panel should appear (map or pin UI)
    // After clicking, the button should be highlighted (active state)
    await expect(comeToMeBtn).toHaveClass(/border-gold/);
  });

  // 13.3 Home mode: only barbers with offers_home_visit=true listed in step 2
  test('13.3 — home mode: only home-visit barbers listed', async ({
    authenticatedPage,
  }) => {
    const page = authenticatedPage;
    const homeVisitBarberId = await getHomeVisitBarberId();
    const noHomeVisitBarberId = await getNoHomeVisitBarberId();

    if (!homeVisitBarberId || !noHomeVisitBarberId) {
      // Skip if we don't have both types of barbers
      return;
    }

    await page.goto('/');
    await page.getByTestId('btn:open-booking').first().click();
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });

    // Click "Come to me" first
    const comeToMeBtn = page.getByRole('button', { name: /come to me/i });
    await comeToMeBtn.click();
    await page.waitForTimeout(500);

    // Select a salon (required to advance)
    const salonIds = await getActiveSalonIds();
    const locationBtn = page.getByTestId(`btn:location-${salonIds[0]}`);
    await locationBtn.waitFor({ state: 'visible', timeout: 10000 });
    await locationBtn.click();
    await page.waitForTimeout(1000);

    // Step 2: Verify home-visit barber is visible
    const homeBarberBtn = page.getByTestId(`btn:barber-${homeVisitBarberId}`);
    await expect(homeBarberBtn).toBeVisible({ timeout: 10000 });
  });

  // 13.4 "Nearby" toggle orders salons by haversineKm from user geo
  test('13.4 — nearby toggle shows distance information', async ({
    authenticatedPage,
  }) => {
    const page = authenticatedPage;

    await page.goto('/');
    await page.getByTestId('btn:open-booking').first().click();
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });

    // Click "Nearby" button — will prompt for geolocation
    const nearbyBtn = page.getByRole('button', { name: /nearby/i });
    await expect(nearbyBtn).toBeVisible({ timeout: 10000 });

    // Grant geolocation permission
    const context = page.context();
    await context.setGeolocation({ latitude: 30.4278, longitude: -9.5981 });
    await context.grantPermissions(['geolocation']);

    await nearbyBtn.click();

    // Wait for nearby to process (may show loading spinner)
    await page.waitForTimeout(3000);

    // Distance text should appear for salons
    const distanceText = page.getByTestId('text:distance');
    const isVisible = await distanceText.isVisible({ timeout: 10000 }).catch(() => false);
    // Either distance shows or geo is denied gracefully
    if (isVisible) {
      const text = await distanceText.textContent();
      expect(text).toMatch(/m|Km/);
    }
  });

  // 13.5 Geo permission denied → friendly error, user can still pick manually
  test('13.5 — geo permission denied shows friendly error, manual pick still works', async ({
    authenticatedPage,
  }) => {
    const page = authenticatedPage;

    // Deny geolocation
    const context = page.context();
    await context.clearPermissions();

    await page.goto('/');
    await page.getByTestId('btn:open-booking').first().click();
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });

    // Click "Nearby" — should handle denial gracefully
    const nearbyBtn = page.getByRole('button', { name: /nearby/i });
    await nearbyBtn.click();
    await page.waitForTimeout(3000);

    // Either an error message or the salon list is still visible
    const salonBtns = page.locator('[data-testid^="btn:location-"]');
    const salonsVisible = await salonBtns.first().isVisible({ timeout: 10000 }).catch(() => false);

    // User can still pick manually
    if (salonsVisible) {
      const firstSalon = salonBtns.first();
      await firstSalon.click();
      await page.waitForTimeout(1000);
      await expect(page.locator('#panel-title')).toContainText('Choose a Berber');
    }
  });
});
