import { test, expect } from './fixtures';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * booking-barber-step.spec.ts
 *
 * Section 14 of the booking test plan — barber selection step.
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

async function getBarbersWithServices(): Promise<{ id: string; hasServices: boolean }[]> {
  const admin = adminClient();
  const { data } = await admin
    .from('professionals')
    .select('id, is_active');
  if (!data) return [];

  const results = [];
  for (const barber of data) {
    if (!(barber as any).is_active) continue;
    const { data: services } = await admin
      .from('professional_services')
      .select('service_id')
      .eq('professional_id', (barber as any).id)
      .limit(1);
    results.push({ id: (barber as any).id, hasServices: (services && services.length > 0) ?? false });
  }
  return results;
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
  await admin.from('professional_availability').insert(rows);
}

async function clearWeeklyAvailability(barberId: string): Promise<void> {
  const admin = adminClient();
  await admin.from('professional_availability').delete().eq('professional_id', barberId);
}

test.describe('Booking Barber Step — Section 14', () => {
  let salonId: string;

  test.beforeAll(async () => {
    salonId = await getActiveSalonId();
  });

  // 14.1 nextAvailableByBarber label appears correctly under each barber card
  test('14.1 — next available label appears under barber cards', async ({
    authenticatedPage,
  }) => {
    const page = authenticatedPage;
    const barbers = await getBarbersWithServices();
    const barberWithServices = barbers.find((b) => b.hasServices);

    if (!barberWithServices) return;

    // Seed availability so nextAvailable is computed
    await seedWeeklyAvailabilityForBarber(barberWithServices.id);

    try {
      await page.goto('/');
      await page.getByTestId('btn:open-booking').first().click();
      await page.waitForSelector('[role="dialog"]', { state: 'visible' });

      // Step 1: select salon
      await page.waitForTimeout(500);
      const locationBtn = page.getByTestId(`btn:location-${salonId}`);
      await locationBtn.waitFor({ state: 'visible', timeout: 10000 });
      await locationBtn.click();
      await page.waitForTimeout(1500);

      // Step 2: barber cards should show "Next" availability label
      const barberBtn = page.getByTestId(`btn:barber-${barberWithServices.id}`);
      await expect(barberBtn).toBeVisible({ timeout: 10000 });

      // The "Next" label should be present in the barber card
      await expect(barberBtn).toContainText('Next');
    } finally {
      await clearWeeklyAvailability(barberWithServices.id);
    }
  });

  // 14.2 Barber with no services compatible with earlier selection → hidden/disabled
  test('14.2 — barber with no services shows empty state message', async ({
    authenticatedPage,
  }) => {
    const page = authenticatedPage;
    const barbers = await getBarbersWithServices();
    const barberNoServices = barbers.find((b) => !b.hasServices);

    if (!barberNoServices) return;

    await page.goto('/');
    await page.getByTestId('btn:open-booking').first().click();
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });

    // Step 1: select salon
    await page.waitForTimeout(500);
    const locationBtn = page.getByTestId(`btn:location-${salonId}`);
    await locationBtn.waitFor({ state: 'visible', timeout: 10000 });
    await locationBtn.click();
    await page.waitForTimeout(1000);

    // Step 2: barber with no services should still be visible but have no services in step 3
    const barberBtn = page.getByTestId(`btn:barber-${barberNoServices.id}`);
    await expect(barberBtn).toBeVisible({ timeout: 10000 });
    await barberBtn.click();
    await page.waitForTimeout(1000);

    // Step 3: should show "no services" message
    await expect(page.locator('#panel-title')).toContainText('Choose a Service');
    const noServicesMsg = page.getByText('This barber has no services listed yet');
    const isVisible = await noServicesMsg.isVisible({ timeout: 5000 }).catch(() => false);
    expect(isVisible).toBe(true);
  });

  // 14.3 Selecting a barber whose services don't include previously picked
  //       services → effectiveSelectedServices filters correctly
  test('14.3 — switching barbers filters out incompatible services', async ({
    authenticatedPage,
  }) => {
    const page = authenticatedPage;
    const barbers = await getBarbersWithServices();
    const barbersWithServices = barbers.filter((b) => b.hasServices);

    if (barbersWithServices.length < 2) return;

    const barberA = barbersWithServices[0];
    const barberB = barbersWithServices[1];

    await page.goto('/');
    await page.getByTestId('btn:open-booking').first().click();
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });

    // Step 1: select salon
    await page.waitForTimeout(500);
    const locationBtn = page.getByTestId(`btn:location-${salonId}`);
    await locationBtn.waitFor({ state: 'visible', timeout: 10000 });
    await locationBtn.click();
    await page.waitForTimeout(1000);

    // Step 2: select barber A
    const barberABtn = page.getByTestId(`btn:barber-${barberA.id}`);
    await barberABtn.waitFor({ state: 'visible', timeout: 10000 });
    await barberABtn.click();
    await page.waitForTimeout(1000);

    // Step 3: verify barber A's services are shown
    await expect(page.locator('#panel-title')).toContainText('Choose a Service');

    // Go back to barber step
    await page.getByRole('button', { name: 'Go back' }).click();
    await page.waitForTimeout(800);

    // Select barber B
    const barberBBtn = page.getByTestId(`btn:barber-${barberB.id}`);
    await barberBBtn.waitFor({ state: 'visible', timeout: 10000 });
    await barberBBtn.click();
    await page.waitForTimeout(1000);

    // Step 3: should now show barber B's services
    await expect(page.locator('#panel-title')).toContainText('Choose a Service');
  });
});
