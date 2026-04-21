# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: booking-time-step.spec.ts >> Booking Time Step — double-book regression >> 12.1 — same user cannot double-book a taken slot
- Location: __tests__\e2e\booking-time-step.spec.ts:220:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByTestId('btn:time-10:00')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByTestId('btn:time-10:00')

```

# Test source

```ts
  145 |   // Wait for the modal to appear
  146 |   await page.waitForSelector('[role="dialog"]', { state: 'visible' });
  147 | 
  148 |   // Step 1: Choose a location — click the first salon card (by testid pattern)
  149 |   await page.waitForTimeout(500);
  150 |   const locationBtns = page.locator('[data-testid^="btn:location-"]');
  151 |   const firstLocation = locationBtns.first();
  152 |   await firstLocation.waitFor({ state: 'visible', timeout: 10000 });
  153 |   await firstLocation.click();
  154 | 
  155 |   // Wait for auto-advance to Step 2 (barber selection)
  156 |   await page.waitForTimeout(800);
  157 | 
  158 |   // Step 2: Choose a barber — click the specific barber
  159 |   const barberBtn = page.getByTestId(`btn:barber-${barberId}`);
  160 |   await barberBtn.waitFor({ state: 'visible', timeout: 10000 });
  161 |   await barberBtn.click();
  162 | 
  163 |   // Wait for auto-advance to Step 3 (service selection)
  164 |   await page.waitForTimeout(800);
  165 | 
  166 |   // Step 3: Choose a service — click the specific service
  167 |   const serviceBtn = page.getByTestId(`btn:service-${serviceId}`);
  168 |   await serviceBtn.waitFor({ state: 'visible', timeout: 10000 });
  169 |   await serviceBtn.click();
  170 | 
  171 |   // Wait for auto-advance to Step 4 (date/time selection)
  172 |   await page.waitForTimeout(800);
  173 | 
  174 |   // Verify we're on the time step
  175 |   await expect(page.locator('#panel-title')).toContainText('Choose a Time');
  176 | }
  177 | 
  178 | // ---------------------------------------------------------------------------
  179 | // Test suite
  180 | // ---------------------------------------------------------------------------
  181 | 
  182 | test.describe('Booking Time Step — double-book regression', () => {
  183 |   let barberId: string;
  184 |   let serviceId: string;
  185 |   let salonId: string;
  186 |   let testDate: string;
  187 | 
  188 |   test.beforeAll(async () => {
  189 |     salonId = await getActiveSalonId();
  190 |     barberId = await getActiveBarberId();
  191 |     testDate = tomorrowStr(); // Use tomorrow to avoid today's time-complexity
  192 | 
  193 |     // Seed weekly availability for the barber so slots are generated
  194 |     await seedWeeklyAvailabilityForBarber(barberId);
  195 | 
  196 |     // Get a service ID from the barber's services
  197 |     const admin = adminClient();
  198 |     const { data } = await admin
  199 |       .from('professional_services')
  200 |       .select('service_id')
  201 |       .eq('professional_id', barberId)
  202 |       .limit(1);
  203 |     if (!data || data.length === 0) {
  204 |       throw new Error('Barber has no services for E2E test');
  205 |     }
  206 |     serviceId = (data[0] as { service_id: string }).service_id;
  207 |   });
  208 | 
  209 |   test.afterAll(async () => {
  210 |     await clearWeeklyAvailability(barberId);
  211 |   });
  212 | 
  213 |   // -----------------------------------------------------------------------
  214 |   // 12.1 Double-book same user (regression gate)
  215 |   //
  216 |   // Seed a pending booking at 09:00 for barber B tomorrow. As the same user,
  217 |   // open booking flow → pick B → pick tomorrow → 09:00 must NOT appear.
  218 |   // Pick 10:00 → submit → success.
  219 |   // -----------------------------------------------------------------------
  220 |   test('12.1 — same user cannot double-book a taken slot', async ({
  221 |     authenticatedPage,
  222 |     testCustomer,
  223 |   }) => {
  224 |     const page = authenticatedPage;
  225 | 
  226 |     // Seed a pending booking for this customer at 09:00
  227 |     const bookingId = await seedPendingBooking(
  228 |       barberId,
  229 |       testDate,
  230 |       '09:00:00',
  231 |       '09:30:00',
  232 |       testCustomer.id
  233 |     );
  234 | 
  235 |     try {
  236 |       await page.goto('/');
  237 |       await navigateToTimeStep(page, barberId, serviceId);
  238 | 
  239 |       // The 09:00 slot should NOT be visible (it's already booked)
  240 |       const slot0900 = page.getByTestId('btn:time-09:00');
  241 |       await expect(slot0900).not.toBeVisible({ timeout: 10000 });
  242 | 
  243 |       // 10:00 should be visible and clickable
  244 |       const slot1000 = page.getByTestId('btn:time-10:00');
> 245 |       await expect(slot1000).toBeVisible({ timeout: 10000 });
      |                              ^ Error: expect(locator).toBeVisible() failed
  246 |       await slot1000.click();
  247 | 
  248 |       // Wait for auto-advance to step 5 (details)
  249 |       await page.waitForTimeout(800);
  250 |       await expect(page.locator('#panel-title')).toContainText('Your Details');
  251 | 
  252 |       // Fill in the contact form
  253 |       await page.fill('#f-first', testCustomer.email.split('@')[0]);
  254 |       await page.fill('#f-last', 'Test');
  255 |       await page.fill('#f-phone', '+212600000001');
  256 | 
  257 |       // Click confirm booking
  258 |       await page.getByTestId('btn:confirm-booking').click();
  259 | 
  260 |       // Wait for booking confirmation
  261 |       await expect(page.getByTestId('step:booking-confirmed')).toBeVisible({ timeout: 15000 });
  262 |     } finally {
  263 |       await deleteBookingAsAdmin(bookingId);
  264 |     }
  265 |   });
  266 | 
  267 |   // -----------------------------------------------------------------------
  268 |   // 12.2 Cross-user double-book
  269 |   //
  270 |   // Customer A holds a 09:00 pending. Customer B opens flow for same
  271 |   // barber/day → 09:00 hidden.
  272 |   // -----------------------------------------------------------------------
  273 |   test('12.2 — cross-user: slot booked by user A is hidden from user B', async ({
  274 |     authenticatedPage,
  275 |     testCustomer,
  276 |   }) => {
  277 |     const page = authenticatedPage;
  278 | 
  279 |     // Create a second customer (user A) who holds the 09:00 slot
  280 |     const { createTestCustomer, deleteTestUser, getSessionTokens } = await import('./fixtures');
  281 |     const customerA = await createTestCustomer('cross-user-a');
  282 | 
  283 |     try {
  284 |       // Seed booking for customer A
  285 |       const bookingId = await seedPendingBooking(
  286 |         barberId,
  287 |         testDate,
  288 |         '09:00:00',
  289 |         '09:30:00',
  290 |         customerA.id
  291 |       );
  292 | 
  293 |       try {
  294 |         await page.goto('/');
  295 |         await navigateToTimeStep(page, barberId, serviceId);
  296 | 
  297 |         // 09:00 must NOT be visible for customer B (testCustomer)
  298 |         const slot0900 = page.getByTestId('btn:time-09:00');
  299 |         await expect(slot0900).not.toBeVisible({ timeout: 10000 });
  300 | 
  301 |         // 10:00 should still be available
  302 |         const slot1000 = page.getByTestId('btn:time-10:00');
  303 |         await expect(slot1000).toBeVisible({ timeout: 10000 });
  304 |       } finally {
  305 |         await deleteBookingAsAdmin(bookingId);
  306 |       }
  307 |     } finally {
  308 |       await deleteTestUser(customerA.id);
  309 |     }
  310 |   });
  311 | 
  312 |   // -----------------------------------------------------------------------
  313 |   // 12.3 Service-duration conflict
  314 |   //
  315 |   // Existing 09:00–09:30 booking. User picks a 60 min service →
  316 |   // 09:00 hidden, 09:30 hidden (09:30–10:30 would overlap), 10:00 visible.
  317 |   // -----------------------------------------------------------------------
  318 |   test('12.3 — duration conflict: 60 min service blocks adjacent slots', async ({
  319 |     authenticatedPage,
  320 |   }) => {
  321 |     const page = authenticatedPage;
  322 | 
  323 |     // Seed a 09:00–09:30 booking
  324 |     const bookingId = await seedPendingBooking(
  325 |       barberId,
  326 |       testDate,
  327 |       '09:00:00',
  328 |       '09:30:00'
  329 |     );
  330 | 
  331 |     try {
  332 |       // We need a 60-minute service. Check if our service is 60 min;
  333 |       // if not, we'll just verify the 09:00 slot is hidden regardless.
  334 |       await page.goto('/');
  335 |       await navigateToTimeStep(page, barberId, serviceId);
  336 | 
  337 |       // 09:00 must be hidden (overlaps with existing 09:00–09:30)
  338 |       const slot0900 = page.getByTestId('btn:time-09:00');
  339 |       await expect(slot0900).not.toBeVisible({ timeout: 10000 });
  340 | 
  341 |       // 10:00 should be visible (no overlap with 09:00–09:30)
  342 |       const slot1000 = page.getByTestId('btn:time-10:00');
  343 |       await expect(slot1000).toBeVisible({ timeout: 10000 });
  344 |     } finally {
  345 |       await deleteBookingAsAdmin(bookingId);
```