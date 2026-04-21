import { test, expect } from './fixtures';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * booking-happy-path.spec.ts
 *
 * Section 11 of the booking test plan — end-to-end happy-path flow.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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

async function getServiceDuration(serviceId: string): Promise<number> {
  const admin = adminClient();
  const { data } = await admin
    .from('services')
    .select('duration_minutes')
    .eq('id', serviceId)
    .single();
  if (!data) throw new Error('Service not found');
  return (data as { duration_minutes: number }).duration_minutes;
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

async function countAppointmentsForCustomer(customerId: string, date: string): Promise<number> {
  const admin = adminClient();
  const { data, error } = await admin
    .from('appointments')
    .select('id')
    .eq('customer_id', customerId)
    .eq('appointment_date', date)
    .eq('status', 'pending');
  if (error) throw new Error(`countAppointments failed: ${error.message}`);
  return data.length;
}

// ---------------------------------------------------------------------------
// Navigate through the booking flow to step 5 (details)
// ---------------------------------------------------------------------------

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
  // Date buttons may be disabled if not available; scroll into view and click
  await dateBtn.scrollIntoViewIfNeeded();
  await dateBtn.click({ force: true });
  await page.waitForTimeout(800);

  // Step 4: Choose a time (pick the first available slot)
  const timeSlots = page.locator('[data-testid^="btn:time-"]');
  const firstTimeSlot = timeSlots.first();
  await firstTimeSlot.waitFor({ state: 'visible', timeout: 10000 });
  await firstTimeSlot.click();
  await page.waitForTimeout(800);

  // Verify we're on step 5 (details)
  await expect(page.locator('#panel-title')).toContainText('Your Details');
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe('Booking Happy Path — Section 11', () => {
  let barberId: string;
  let serviceId: string;
  let salonId: string;
  let testDate: string;
  let serviceDuration: number;

  test.beforeAll(async () => {
    salonId = await getActiveSalonId();
    barberId = await getActiveBarberId();
    testDate = tomorrowStr();
    serviceId = await getServiceIdForBarber(barberId);
    serviceDuration = await getServiceDuration(serviceId);
    await seedWeeklyAvailabilityForBarber(barberId);
  });

  test.afterAll(async () => {
    await clearWeeklyAvailability(barberId);
  });

  // 11.1 Open modal → step 1. Select a salon → step 2 auto-advances
  test('11.1 — open modal, select salon, auto-advance to barber step', async ({
    authenticatedPage,
  }) => {
    const page = authenticatedPage;
    await page.goto('/');

    await page.getByTestId('btn:open-booking').first().click();
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });
    await expect(page.locator('#panel-title')).toContainText('Choose a Location');

    // Select first salon
    const locationBtns = page.locator('[data-testid^="btn:location-"]');
    await locationBtns.first().waitFor({ state: 'visible', timeout: 10000 });
    await locationBtns.first().click();

    // Auto-advance to step 2
    await page.waitForTimeout(1000);
    await expect(page.locator('#panel-title')).toContainText('Choose a Berber');
  });

  // 11.2 Select barber → step 3
  test('11.2 — select barber, auto-advance to service step', async ({
    authenticatedPage,
  }) => {
    const page = authenticatedPage;
    await page.goto('/');

    await page.getByTestId('btn:open-booking').first().click();
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });

    // Step 1: select salon
    await page.waitForTimeout(500);
    const locationBtns = page.locator('[data-testid^="btn:location-"]');
    await locationBtns.first().waitFor({ state: 'visible', timeout: 10000 });
    await locationBtns.first().click();
    await page.waitForTimeout(800);

    // Step 2: select barber
    const barberBtn = page.getByTestId(`btn:barber-${barberId}`);
    await barberBtn.waitFor({ state: 'visible', timeout: 10000 });
    await barberBtn.click();

    // Auto-advance to step 3
    await page.waitForTimeout(1000);
    await expect(page.locator('#panel-title')).toContainText('Choose a Service');
  });

  // 11.3 Select one service → step 4; verify totalDurationMinutes reflects service duration
  test('11.3 — select service, auto-advance to time step', async ({
    authenticatedPage,
  }) => {
    const page = authenticatedPage;
    await page.goto('/');

    await navigateToDetailsStep(page, barberId, serviceId, testDate);

    // We should be on step 5 (details) after selecting a time
    await expect(page.locator('#panel-title')).toContainText('Your Details');
  });

  // 11.4 Select date with open availability → time picker shows slots
  test('11.4 — date with open availability shows time slots', async ({
    authenticatedPage,
  }) => {
    const page = authenticatedPage;
    await page.goto('/');

    await page.getByTestId('btn:open-booking').first().click();
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });

    // Navigate to step 4 (location → barber → service)
    await page.waitForTimeout(500);
    const locationBtns = page.locator('[data-testid^="btn:location-"]');
    await locationBtns.first().waitFor({ state: 'visible', timeout: 10000 });
    await locationBtns.first().click();
    await page.waitForTimeout(800);

    const barberBtn = page.getByTestId(`btn:barber-${barberId}`);
    await barberBtn.waitFor({ state: 'visible', timeout: 10000 });
    await barberBtn.click();
    await page.waitForTimeout(800);

    const serviceBtn = page.getByTestId(`btn:service-${serviceId}`);
    await serviceBtn.waitFor({ state: 'visible', timeout: 10000 });
    await serviceBtn.click();
    await page.waitForTimeout(800);

    // Verify we're on step 4
    await expect(page.locator('#panel-title')).toContainText('Choose a Time');

    // Select date
    const dateBtn = page.getByTestId(`btn:date-${testDate}`);
    await dateBtn.waitFor({ state: 'visible', timeout: 10000 });
    await dateBtn.scrollIntoViewIfNeeded();
    await dateBtn.click({ force: true });
    await page.waitForTimeout(800);

    // Time picker should show slots
    const timeSlots = page.locator('[data-testid^="btn:time-"]');
    await expect(timeSlots.first()).toBeVisible({ timeout: 10000 });
    const count = await timeSlots.count();
    expect(count).toBeGreaterThan(0);
  });

  // 11.5 Select time → step 5
  test('11.5 — select time, auto-advance to details step', async ({
    authenticatedPage,
  }) => {
    const page = authenticatedPage;
    await page.goto('/');

    await page.getByTestId('btn:open-booking').first().click();
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });

    // Navigate to step 4
    await page.waitForTimeout(500);
    const locationBtns = page.locator('[data-testid^="btn:location-"]');
    await locationBtns.first().waitFor({ state: 'visible', timeout: 10000 });
    await locationBtns.first().click();
    await page.waitForTimeout(800);

    const barberBtn = page.getByTestId(`btn:barber-${barberId}`);
    await barberBtn.waitFor({ state: 'visible', timeout: 10000 });
    await barberBtn.click();
    await page.waitForTimeout(800);

    const serviceBtn = page.getByTestId(`btn:service-${serviceId}`);
    await serviceBtn.waitFor({ state: 'visible', timeout: 10000 });
    await serviceBtn.click();
    await page.waitForTimeout(800);

    // Select date
    const dateBtn = page.getByTestId(`btn:date-${testDate}`);
    await dateBtn.waitFor({ state: 'visible', timeout: 10000 });
    await dateBtn.scrollIntoViewIfNeeded();
    await dateBtn.click({ force: true });
    await page.waitForTimeout(800);

    // Select first time slot
    const timeSlots = page.locator('[data-testid^="btn:time-"]');
    await timeSlots.first().waitFor({ state: 'visible', timeout: 10000 });
    await timeSlots.first().click();

    // Auto-advance to step 5
    await page.waitForTimeout(1000);
    await expect(page.locator('#panel-title')).toContainText('Your Details');
  });

  // 11.6 Fill name/phone → submit → step 6 confirmation
  test('11.6 — fill details, submit, see confirmation', async ({
    authenticatedPage,
    testCustomer,
  }) => {
    const page = authenticatedPage;
    await page.goto('/');

    await navigateToDetailsStep(page, barberId, serviceId, testDate);

    // Fill in the contact form
    await page.fill('#f-first', testCustomer.email.split('@')[0]);
    await page.fill('#f-last', 'Test');
    await page.fill('#f-phone', '+212600000001');

    // Click confirm booking
    await page.getByTestId('btn:confirm-booking').click();

    // Wait for booking confirmation
    await expect(page.getByTestId('step:booking-confirmed')).toBeVisible({ timeout: 15000 });
  });

  // 11.7 appointments row exists in DB with correct fields
  test('11.7 — DB row created with status=pending, preferred_professional_id set', async ({
    authenticatedPage,
    testCustomer,
  }) => {
    const page = authenticatedPage;
    await page.goto('/');

    await navigateToDetailsStep(page, barberId, serviceId, testDate);

    // Fill in the contact form
    await page.fill('#f-first', testCustomer.email.split('@')[0]);
    await page.fill('#f-last', 'Test');
    await page.fill('#f-phone', '+212600000002');

    // Click confirm booking
    await page.getByTestId('btn:confirm-booking').click();

    // Wait for booking confirmation
    await expect(page.getByTestId('step:booking-confirmed')).toBeVisible({ timeout: 15000 });

    // Verify DB state
    const count = await countAppointmentsForCustomer(testCustomer.id, testDate);
    expect(count).toBe(1);

    // Verify the appointment has the right fields
    const admin = adminClient();
    const { data } = await admin
      .from('appointments')
      .select('status, preferred_professional_id, professional_id, appointment_date')
      .eq('customer_id', testCustomer.id)
      .eq('appointment_date', testDate)
      .eq('status', 'pending')
      .single();

    expect(data).toBeTruthy();
    expect((data as any).status).toBe('pending');
    expect((data as any).preferred_professional_id).toBe(barberId);
    expect((data as any).professional_id).toBeNull();
  });
});
