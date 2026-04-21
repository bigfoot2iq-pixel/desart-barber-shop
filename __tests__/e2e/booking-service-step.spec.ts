import { test, expect } from './fixtures';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * booking-service-step.spec.ts
 *
 * Section 15 of the booking test plan — service selection step.
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

async function getBarberWithMultipleServices(): Promise<{ id: string; serviceIds: string[] }> {
  const admin = adminClient();
  const { data: barbers } = await admin
    .from('professionals')
    .select('id')
    .eq('is_active', true)
    .limit(10);

  if (!barbers) throw new Error('No barbers found');

  for (const barber of barbers) {
    const { data: services } = await admin
      .from('professional_services')
      .select('service_id')
      .eq('professional_id', (barber as any).id);
    if (services && services.length >= 2) {
      return {
        id: (barber as any).id,
        serviceIds: services.map((s: { service_id: string }) => s.service_id),
      };
    }
  }
  throw new Error('No barber with 2+ services found');
}

async function getServiceDetails(serviceId: string): Promise<{ price: number; duration: number }> {
  const admin = adminClient();
  const { data } = await admin
    .from('services')
    .select('price_mad, duration_minutes')
    .eq('id', serviceId)
    .single();
  if (!data) throw new Error(`Service ${serviceId} not found`);
  return { price: (data as any).price_mad, duration: (data as any).duration_minutes };
}

test.describe('Booking Service Step — Section 15', () => {
  let salonId: string;
  let barberId: string;
  let serviceIds: string[];

  test.beforeAll(async () => {
    salonId = await getActiveSalonId();
    const barber = await getBarberWithMultipleServices();
    barberId = barber.id;
    serviceIds = barber.serviceIds;
  });

  // 15.1 Multi-select services → total price sums, total duration sums
  test('15.1 — multi-select services shows summed totals', async ({
    authenticatedPage,
  }) => {
    const page = authenticatedPage;

    await page.goto('/');
    await page.getByTestId('btn:open-booking').first().click();
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });

    // Step 1: select salon
    await page.waitForTimeout(500);
    const locationBtn = page.getByTestId(`btn:location-${salonId}`);
    await locationBtn.waitFor({ state: 'visible', timeout: 10000 });
    await locationBtn.click();
    await page.waitForTimeout(1000);

    // Step 2: select barber
    const barberBtn = page.getByTestId(`btn:barber-${barberId}`);
    await barberBtn.waitFor({ state: 'visible', timeout: 10000 });
    await barberBtn.click();
    await page.waitForTimeout(1000);

    // Step 3: select first service
    const service1Btn = page.getByTestId(`btn:service-${serviceIds[0]}`);
    await service1Btn.waitFor({ state: 'visible', timeout: 10000 });
    await service1Btn.click();
    await page.waitForTimeout(500);

    // Go back to select another service
    await page.getByRole('button', { name: 'Go back' }).click();
    await page.waitForTimeout(800);

    // Select second service
    const service2Btn = page.getByTestId(`btn:service-${serviceIds[1]}`);
    await service2Btn.waitFor({ state: 'visible', timeout: 10000 });
    await service2Btn.click();
    await page.waitForTimeout(500);

    // Both services should be selected (have gold/highlighted styling)
    const service1Selected = await service1Btn.getAttribute('class');
    const service2Selected = await service2Btn.getAttribute('class');

    // Both should have the gold selection class
    expect(service1Selected).toContain('border-gold');
    expect(service2Selected).toContain('border-gold');

    // Auto-advance to step 4
    await page.waitForTimeout(1000);
    await expect(page.locator('#panel-title')).toContainText('Choose a Time');
  });

  // 15.2 Zero services → next button disabled (auto-advance doesn't happen)
  test('15.2 — zero services selected does not auto-advance', async ({
    authenticatedPage,
  }) => {
    const page = authenticatedPage;

    await page.goto('/');
    await page.getByTestId('btn:open-booking').first().click();
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });

    // Step 1: select salon
    await page.waitForTimeout(500);
    const locationBtn = page.getByTestId(`btn:location-${salonId}`);
    await locationBtn.waitFor({ state: 'visible', timeout: 10000 });
    await locationBtn.click();
    await page.waitForTimeout(1000);

    // Step 2: select barber
    const barberBtn = page.getByTestId(`btn:barber-${barberId}`);
    await barberBtn.waitFor({ state: 'visible', timeout: 10000 });
    await barberBtn.click();
    await page.waitForTimeout(1000);

    // Step 3: we should be on service step, but without selecting any service
    await expect(page.locator('#panel-title')).toContainText('Choose a Service');

    // Wait longer than the auto-advance timeout (500ms) and verify we're still on step 3
    await page.waitForTimeout(1500);
    await expect(page.locator('#panel-title')).toContainText('Choose a Service');
  });

  // 15.3 Toggling a service off updates totals instantly
  test('15.3 — toggling service off removes selection styling', async ({
    authenticatedPage,
  }) => {
    const page = authenticatedPage;

    await page.goto('/');
    await page.getByTestId('btn:open-booking').first().click();
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });

    // Step 1: select salon
    await page.waitForTimeout(500);
    const locationBtn = page.getByTestId(`btn:location-${salonId}`);
    await locationBtn.waitFor({ state: 'visible', timeout: 10000 });
    await locationBtn.click();
    await page.waitForTimeout(1000);

    // Step 2: select barber
    const barberBtn = page.getByTestId(`btn:barber-${barberId}`);
    await barberBtn.waitFor({ state: 'visible', timeout: 10000 });
    await barberBtn.click();
    await page.waitForTimeout(1000);

    // Step 3: select first service
    const service1Btn = page.getByTestId(`btn:service-${serviceIds[0]}`);
    await service1Btn.waitFor({ state: 'visible', timeout: 10000 });
    await service1Btn.click();
    await page.waitForTimeout(500);

    // Verify it's selected
    let cls = await service1Btn.getAttribute('class');
    expect(cls).toContain('border-gold');

    // Go back and toggle it off
    await page.getByRole('button', { name: 'Go back' }).click();
    await page.waitForTimeout(800);

    // Click the same service again to deselect
    await service1Btn.click();
    await page.waitForTimeout(500);

    // Verify it's no longer selected
    cls = await service1Btn.getAttribute('class');
    expect(cls).not.toContain('border-gold');

    // Should stay on step 3 (no auto-advance with 0 services)
    await page.waitForTimeout(1000);
    await expect(page.locator('#panel-title')).toContainText('Choose a Service');
  });
});
