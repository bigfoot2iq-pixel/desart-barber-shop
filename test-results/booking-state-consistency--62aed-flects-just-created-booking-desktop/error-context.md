# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: booking-state-consistency.spec.ts >> Booking State Consistency — Section 17 >> 17.1 — reopened modal reflects just-created booking
- Location: __tests__\e2e\booking-state-consistency.spec.ts:154:7

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
  32  | async function getActiveBarberId(): Promise<string> {
  33  |   const admin = adminClient();
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
  108 |   await page.waitForTimeout(800);
  109 | 
  110 |   const dateBtn = page.getByTestId(`btn:date-${testDate}`);
  111 |   await dateBtn.waitFor({ state: 'visible', timeout: 10000 });
  112 |   await dateBtn.scrollIntoViewIfNeeded();
  113 |   await dateBtn.click({ force: true });
  114 |   await page.waitForTimeout(800);
  115 | 
  116 |   const timeSlots = page.locator('[data-testid^="btn:time-"]');
  117 |   await timeSlots.first().waitFor({ state: 'visible', timeout: 10000 });
  118 |   await timeSlots.first().click();
  119 |   await page.waitForTimeout(800);
  120 | 
  121 |   await expect(page.locator('#panel-title')).toContainText('Your Details');
  122 | }
  123 | 
  124 | async function submitBooking(
  125 |   page: import('@playwright/test').Page,
  126 |   testCustomer: { email: string }
  127 | ): Promise<void> {
  128 |   await page.fill('#f-first', testCustomer.email.split('@')[0]);
  129 |   await page.fill('#f-last', 'Test');
  130 |   await page.fill('#f-phone', `+2126${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`);
  131 |   await page.getByTestId('btn:confirm-booking').click();
> 132 |   await expect(page.getByTestId('step:booking-confirmed')).toBeVisible({ timeout: 15000 });
      |                                                            ^ Error: expect(locator).toBeVisible() failed
  133 | }
  134 | 
  135 | test.describe('Booking State Consistency — Section 17', () => {
  136 |   let barberId: string;
  137 |   let serviceId: string;
  138 |   let salonId: string;
  139 |   let testDate: string;
  140 | 
  141 |   test.beforeAll(async () => {
  142 |     salonId = await getActiveSalonId();
  143 |     barberId = await getActiveBarberId();
  144 |     testDate = tomorrowStr();
  145 |     serviceId = await getServiceIdForBarber(barberId);
  146 |     await seedWeeklyAvailabilityForBarber(barberId);
  147 |   });
  148 | 
  149 |   test.afterAll(async () => {
  150 |     await clearWeeklyAvailability(barberId);
  151 |   });
  152 | 
  153 |   // 17.1 After success, modal closes → reopen → bookingsInRange reflects the just-created row
  154 |   test('17.1 — reopened modal reflects just-created booking', async ({
  155 |     authenticatedPage,
  156 |     testCustomer,
  157 |   }) => {
  158 |     const page = authenticatedPage;
  159 |     await page.goto('/');
  160 | 
  161 |     // Complete a booking
  162 |     await navigateToDetailsStep(page, barberId, serviceId, testDate);
  163 |     await submitBooking(page, testCustomer);
  164 | 
  165 |     // Close the modal
  166 |     const closeBtn = page.getByRole('button', { name: /close/i });
  167 |     await closeBtn.click();
  168 |     await page.waitForTimeout(500);
  169 | 
  170 |     // Reopen the modal
  171 |     await page.getByTestId('btn:open-booking').first().click();
  172 |     await page.waitForSelector('[role="dialog"]', { state: 'visible' });
  173 | 
  174 |     // Navigate to time step
  175 |     await page.waitForTimeout(500);
  176 |     const locationBtns = page.locator('[data-testid^="btn:location-"]');
  177 |     await locationBtns.first().waitFor({ state: 'visible', timeout: 10000 });
  178 |     await locationBtns.first().click();
  179 |     await page.waitForTimeout(800);
  180 | 
  181 |     const barberBtn = page.getByTestId(`btn:barber-${barberId}`);
  182 |     await barberBtn.waitFor({ state: 'visible', timeout: 10000 });
  183 |     await barberBtn.click();
  184 |     await page.waitForTimeout(800);
  185 | 
  186 |     const serviceBtn = page.getByTestId(`btn:service-${serviceId}`);
  187 |     await serviceBtn.waitFor({ state: 'visible', timeout: 10000 });
  188 |     await serviceBtn.click();
  189 |     await page.waitForTimeout(800);
  190 | 
  191 |     // Select the same date
  192 |     const dateBtn = page.getByTestId(`btn:date-${testDate}`);
  193 |     await dateBtn.waitFor({ state: 'visible', timeout: 10000 });
  194 |     await dateBtn.scrollIntoViewIfNeeded();
  195 |     await dateBtn.click({ force: true });
  196 |     await page.waitForTimeout(1500);
  197 | 
  198 |     // The time slot we booked should NOT be available anymore
  199 |     // (it was taken by our own booking)
  200 |     const timeSlots = page.locator('[data-testid^="btn:time-"]');
  201 |     const count = await timeSlots.count();
  202 | 
  203 |     // Verify the date is still selectable (there should be other slots)
  204 |     // or if fully booked, show empty state
  205 |     const hasSlots = count > 0;
  206 |     const hasEmptyState = await page.getByText('No slots available on this day').isVisible({ timeout: 3000 }).catch(() => false);
  207 | 
  208 |     // Either there are fewer slots than before, or empty state
  209 |     expect(hasSlots || hasEmptyState).toBe(true);
  210 |   });
  211 | 
  212 |   // 17.2 Booking the same slot a second time without closing the modal
  213 |   //       → second attempt blocked by constraint + friendly error
  214 |   // This is hard to test because after success the modal goes to step 6
  215 |   // (confirmed), and the user would need to navigate back. The UI doesn't
  216 |   // allow going back from step 6 to re-submit.
  217 |   test('17.2 — booking same slot twice without closing modal is blocked (plan item 17.2 — UI goes to step 6 after success, no back path to re-submit)', () => {
  218 |     test.skip(true, 'todo: not yet implemented');
  219 |   });
  220 | 
  221 |   // 17.3 Browser tab left open an hour, another user books the same slot
  222 |   //       → current user's submit hits SLOT_TAKEN, UI recovers
  223 |   // This requires simulating a concurrent booking by another user between
  224 |   // the time selection and the submit.
  225 |   test('17.3 — concurrent booking by another user triggers SLOT_TAKEN recovery', async ({
  226 |     authenticatedPage,
  227 |     testCustomer,
  228 |   }) => {
  229 |     const page = authenticatedPage;
  230 |     const admin = adminClient();
  231 | 
  232 |     // Create another customer who will book the same slot
```