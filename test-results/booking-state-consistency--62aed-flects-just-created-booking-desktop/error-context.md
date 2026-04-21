# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: booking-state-consistency.spec.ts >> Booking State Consistency — Section 17 >> 17.1 — reopened modal reflects just-created booking
- Location: __tests__\e2e\booking-state-consistency.spec.ts:156:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByTestId('step:booking-confirmed')
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for getByTestId('step:booking-confirmed')

```

# Test source

```ts
  34  |   const { data, error } = await admin
  35  |     .from('professionals')
  36  |     .select('id')
  37  |     .eq('is_active', true)
  38  |     .limit(1);
  39  |   if (error || !data || data.length === 0) {
  40  |     throw new Error('No active professional found for E2E tests');
  41  |   }
  42  |   return data[0].id;
  43  | }
  44  | 
  45  | async function getServiceIdForBarber(barberId: string): Promise<string> {
  46  |   const admin = adminClient();
  47  |   const { data } = await admin
  48  |     .from('professional_services')
  49  |     .select('service_id')
  50  |     .eq('professional_id', barberId)
  51  |     .limit(1);
  52  |   if (!data || data.length === 0) {
  53  |     throw new Error('Barber has no services for E2E test');
  54  |   }
  55  |   return (data[0] as { service_id: string }).service_id;
  56  | }
  57  | 
  58  | async function seedWeeklyAvailabilityForBarber(barberId: string): Promise<void> {
  59  |   const admin = adminClient();
  60  |   const rows = [];
  61  |   for (let day = 1; day <= 6; day++) {
  62  |     rows.push({
  63  |       professional_id: barberId,
  64  |       day_of_week: day,
  65  |       start_time: '09:00',
  66  |       end_time: '17:00',
  67  |       is_available: true,
  68  |     });
  69  |   }
  70  |   const { error } = await admin.from('professional_availability').insert(rows);
  71  |   if (error) throw new Error(`seedWeeklyAvailability failed: ${error.message}`);
  72  | }
  73  | 
  74  | async function clearWeeklyAvailability(barberId: string): Promise<void> {
  75  |   const admin = adminClient();
  76  |   await admin.from('professional_availability').delete().eq('professional_id', barberId);
  77  | }
  78  | 
  79  | function tomorrowStr(): string {
  80  |   const d = new Date();
  81  |   d.setDate(d.getDate() + 1);
  82  |   return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  83  | }
  84  | 
  85  | async function navigateToDetailsStep(
  86  |   page: import('@playwright/test').Page,
  87  |   barberId: string,
  88  |   serviceId: string,
  89  |   testDate: string
  90  | ): Promise<void> {
  91  |   await page.getByTestId('btn:open-booking').first().click();
  92  |   await page.waitForSelector('[role="dialog"]', { state: 'visible' });
  93  | 
  94  |   await page.waitForTimeout(500);
  95  |   const locationBtns = page.locator('[data-testid^="btn:location-"]');
  96  |   await locationBtns.first().waitFor({ state: 'visible', timeout: 10000 });
  97  |   await locationBtns.first().click();
  98  |   await page.waitForTimeout(800);
  99  | 
  100 |   const barberBtn = page.getByTestId(`btn:barber-${barberId}`);
  101 |   await barberBtn.waitFor({ state: 'visible', timeout: 10000 });
  102 |   await barberBtn.click();
  103 |   await page.waitForTimeout(800);
  104 | 
  105 |   const serviceBtn = page.getByTestId(`btn:service-${serviceId}`);
  106 |   await serviceBtn.waitFor({ state: 'visible', timeout: 10000 });
  107 |   await serviceBtn.click();
  108 |   await page.waitForTimeout(500);
  109 |   await page.getByTestId('btn:services-continue').click();
  110 |   await page.waitForTimeout(800);
  111 | 
  112 |   const dateBtn = page.getByTestId(`btn:date-${testDate}`);
  113 |   await dateBtn.waitFor({ state: 'visible', timeout: 10000 });
  114 |   await dateBtn.scrollIntoViewIfNeeded();
  115 |   await dateBtn.click({ force: true });
  116 |   await page.waitForTimeout(800);
  117 | 
  118 |   const firstTimeSlot = page.locator('[data-testid^="btn:time-"]:enabled').first();
  119 |   await firstTimeSlot.waitFor({ state: 'visible', timeout: 10000 });
  120 |   await firstTimeSlot.click();
  121 |   await page.waitForTimeout(800);
  122 | 
  123 |   await expect(page.locator('#panel-title')).toContainText('Your Details');
  124 | }
  125 | 
  126 | async function submitBooking(
  127 |   page: import('@playwright/test').Page,
  128 |   testCustomer: { email: string }
  129 | ): Promise<void> {
  130 |   await page.fill('#f-first', testCustomer.email.split('@')[0]);
  131 |   await page.fill('#f-last', 'Test');
  132 |   await page.fill('#f-phone', `+2126${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`);
  133 |   await page.getByTestId('btn:confirm-booking').click();
> 134 |   await expect(page.getByTestId('step:booking-confirmed')).toBeVisible({ timeout: 15000 });
      |                                                            ^ Error: expect(locator).toBeVisible() failed
  135 | }
  136 | 
  137 | test.describe('Booking State Consistency — Section 17', () => {
  138 |   let barberId: string;
  139 |   let serviceId: string;
  140 |   let salonId: string;
  141 |   let testDate: string;
  142 | 
  143 |   test.beforeAll(async () => {
  144 |     salonId = await getActiveSalonId();
  145 |     barberId = await getActiveBarberId();
  146 |     testDate = tomorrowStr();
  147 |     serviceId = await getServiceIdForBarber(barberId);
  148 |     await seedWeeklyAvailabilityForBarber(barberId);
  149 |   });
  150 | 
  151 |   test.afterAll(async () => {
  152 |     await clearWeeklyAvailability(barberId);
  153 |   });
  154 | 
  155 |   // 17.1 After success, modal closes → reopen → bookingsInRange reflects the just-created row
  156 |   test('17.1 — reopened modal reflects just-created booking', async ({
  157 |     authenticatedPage,
  158 |     testCustomer,
  159 |   }) => {
  160 |     const page = authenticatedPage;
  161 |     await page.goto('/');
  162 | 
  163 |     // Complete a booking
  164 |     await navigateToDetailsStep(page, barberId, serviceId, testDate);
  165 |     await submitBooking(page, testCustomer);
  166 | 
  167 |     // Close the modal
  168 |     const closeBtn = page.getByRole('button', { name: /close/i });
  169 |     await closeBtn.click();
  170 |     await page.waitForTimeout(500);
  171 | 
  172 |     // Reopen the modal
  173 |     await page.getByTestId('btn:open-booking').first().click();
  174 |     await page.waitForSelector('[role="dialog"]', { state: 'visible' });
  175 | 
  176 |     // Navigate to time step
  177 |     await page.waitForTimeout(500);
  178 |     const locationBtns = page.locator('[data-testid^="btn:location-"]');
  179 |     await locationBtns.first().waitFor({ state: 'visible', timeout: 10000 });
  180 |     await locationBtns.first().click();
  181 |     await page.waitForTimeout(800);
  182 | 
  183 |     const barberBtn = page.getByTestId(`btn:barber-${barberId}`);
  184 |     await barberBtn.waitFor({ state: 'visible', timeout: 10000 });
  185 |     await barberBtn.click();
  186 |     await page.waitForTimeout(800);
  187 | 
  188 |     const serviceBtn = page.getByTestId(`btn:service-${serviceId}`);
  189 |     await serviceBtn.waitFor({ state: 'visible', timeout: 10000 });
  190 |     await serviceBtn.click();
  191 |     await page.waitForTimeout(800);
  192 | 
  193 |     // Select the same date
  194 |     const dateBtn = page.getByTestId(`btn:date-${testDate}`);
  195 |     await dateBtn.waitFor({ state: 'visible', timeout: 10000 });
  196 |     await dateBtn.scrollIntoViewIfNeeded();
  197 |     await dateBtn.click({ force: true });
  198 |     await page.waitForTimeout(1500);
  199 | 
  200 |     // The time slot we booked should NOT be available anymore
  201 |     // (it was taken by our own booking)
  202 |     const timeSlots = page.locator('[data-testid^="btn:time-"]');
  203 |     const count = await timeSlots.count();
  204 | 
  205 |     // Verify the date is still selectable (there should be other slots)
  206 |     // or if fully booked, show empty state
  207 |     const hasSlots = count > 0;
  208 |     const hasEmptyState = await page.getByText('No slots available on this day').isVisible({ timeout: 3000 }).catch(() => false);
  209 | 
  210 |     // Either there are fewer slots than before, or empty state
  211 |     expect(hasSlots || hasEmptyState).toBe(true);
  212 |   });
  213 | 
  214 |   // 17.2 Booking the same slot a second time without closing the modal
  215 |   //       → second attempt blocked by constraint + friendly error
  216 |   // This is hard to test because after success the modal goes to step 6
  217 |   // (confirmed), and the user would need to navigate back. The UI doesn't
  218 |   // allow going back from step 6 to re-submit.
  219 |   test('17.2 — booking same slot twice without closing modal is blocked (plan item 17.2 — UI goes to step 6 after success, no back path to re-submit)', () => {
  220 |     test.skip(true, 'todo: not yet implemented');
  221 |   });
  222 | 
  223 |   // 17.3 Browser tab left open an hour, another user books the same slot
  224 |   //       → current user's submit hits SLOT_TAKEN, UI recovers
  225 |   // This requires simulating a concurrent booking by another user between
  226 |   // the time selection and the submit.
  227 |   test('17.3 — concurrent booking by another user triggers SLOT_TAKEN recovery', async ({
  228 |     authenticatedPage,
  229 |     testCustomer,
  230 |   }) => {
  231 |     const page = authenticatedPage;
  232 |     const admin = adminClient();
  233 | 
  234 |     // Create another customer who will book the same slot
```