# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: booking-happy-path.spec.ts >> Booking Happy Path — Section 11 >> 11.6 — fill details, submit, see confirmation
- Location: __tests__\e2e\booking-happy-path.spec.ts:342:7

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
  260 |     await page.waitForTimeout(500);
  261 |     const locationBtns = page.locator('[data-testid^="btn:location-"]');
  262 |     await locationBtns.first().waitFor({ state: 'visible', timeout: 10000 });
  263 |     await locationBtns.first().click();
  264 |     await page.waitForTimeout(800);
  265 | 
  266 |     const barberBtn = page.getByTestId(`btn:barber-${barberId}`);
  267 |     await barberBtn.waitFor({ state: 'visible', timeout: 10000 });
  268 |     await barberBtn.click();
  269 |     await page.waitForTimeout(800);
  270 | 
  271 |     const serviceBtn = page.getByTestId(`btn:service-${serviceId}`);
  272 |     await serviceBtn.waitFor({ state: 'visible', timeout: 10000 });
  273 |     await serviceBtn.click();
  274 |     await page.waitForTimeout(500);
  275 |     await page.getByTestId('btn:services-continue').click();
  276 |     await page.waitForTimeout(800);
  277 | 
  278 |     // Verify we're on step 4
  279 |     await expect(page.locator('#panel-title')).toContainText('Choose a Time');
  280 | 
  281 |     // Select date
  282 |     const dateBtn = page.getByTestId(`btn:date-${testDate}`);
  283 |     await dateBtn.waitFor({ state: 'visible', timeout: 10000 });
  284 |     await dateBtn.scrollIntoViewIfNeeded();
  285 |     await dateBtn.click({ force: true });
  286 |     await page.waitForTimeout(800);
  287 | 
  288 |     // Time picker should show slots
  289 |     const timeSlots = page.locator('[data-testid^="btn:time-"]');
  290 |     await expect(timeSlots.first()).toBeVisible({ timeout: 10000 });
  291 |     const count = await timeSlots.count();
  292 |     expect(count).toBeGreaterThan(0);
  293 |   });
  294 | 
  295 |   // 11.5 Select time → step 5
  296 |   test('11.5 — select time, auto-advance to details step', async ({
  297 |     authenticatedPage,
  298 |   }) => {
  299 |     const page = authenticatedPage;
  300 |     await page.goto('/');
  301 | 
  302 |     await page.getByTestId('btn:open-booking').first().click();
  303 |     await page.waitForSelector('[role="dialog"]', { state: 'visible' });
  304 | 
  305 |     // Navigate to step 4
  306 |     await page.waitForTimeout(500);
  307 |     const locationBtns = page.locator('[data-testid^="btn:location-"]');
  308 |     await locationBtns.first().waitFor({ state: 'visible', timeout: 10000 });
  309 |     await locationBtns.first().click();
  310 |     await page.waitForTimeout(800);
  311 | 
  312 |     const barberBtn = page.getByTestId(`btn:barber-${barberId}`);
  313 |     await barberBtn.waitFor({ state: 'visible', timeout: 10000 });
  314 |     await barberBtn.click();
  315 |     await page.waitForTimeout(800);
  316 | 
  317 |     const serviceBtn = page.getByTestId(`btn:service-${serviceId}`);
  318 |     await serviceBtn.waitFor({ state: 'visible', timeout: 10000 });
  319 |     await serviceBtn.click();
  320 |     await page.waitForTimeout(500);
  321 |     await page.getByTestId('btn:services-continue').click();
  322 |     await page.waitForTimeout(800);
  323 | 
  324 |     // Select date
  325 |     const dateBtn = page.getByTestId(`btn:date-${testDate}`);
  326 |     await dateBtn.waitFor({ state: 'visible', timeout: 10000 });
  327 |     await dateBtn.scrollIntoViewIfNeeded();
  328 |     await dateBtn.click({ force: true });
  329 |     await page.waitForTimeout(800);
  330 | 
  331 |     // Select first available time slot
  332 |     const firstTimeSlot = page.locator('[data-testid^="btn:time-"]:enabled').first();
  333 |     await firstTimeSlot.waitFor({ state: 'visible', timeout: 10000 });
  334 |     await firstTimeSlot.click();
  335 | 
  336 |     // Auto-advance to step 5
  337 |     await page.waitForTimeout(1000);
  338 |     await expect(page.locator('#panel-title')).toContainText('Your Details');
  339 |   });
  340 | 
  341 |   // 11.6 Fill name/phone → submit → step 6 confirmation
  342 |   test('11.6 — fill details, submit, see confirmation', async ({
  343 |     authenticatedPage,
  344 |     testCustomer,
  345 |   }) => {
  346 |     const page = authenticatedPage;
  347 |     await page.goto('/');
  348 | 
  349 |     await navigateToDetailsStep(page, barberId, serviceId, testDate);
  350 | 
  351 |     // Fill in the contact form
  352 |     await page.fill('#f-first', testCustomer.email.split('@')[0]);
  353 |     await page.fill('#f-last', 'Test');
  354 |     await page.fill('#f-phone', '+212600000001');
  355 | 
  356 |     // Click confirm booking
  357 |     await page.getByTestId('btn:confirm-booking').click();
  358 | 
  359 |     // Wait for booking confirmation
> 360 |     await expect(page.getByTestId('step:booking-confirmed')).toBeVisible({ timeout: 15000 });
      |                                                              ^ Error: expect(locator).toBeVisible() failed
  361 |   });
  362 | 
  363 |   // 11.7 appointments row exists in DB with correct fields
  364 |   test('11.7 — DB row created with status=pending, preferred_professional_id set', async ({
  365 |     authenticatedPage,
  366 |     testCustomer,
  367 |   }) => {
  368 |     const page = authenticatedPage;
  369 |     await page.goto('/');
  370 | 
  371 |     await navigateToDetailsStep(page, barberId, serviceId, testDate);
  372 | 
  373 |     // Fill in the contact form
  374 |     await page.fill('#f-first', testCustomer.email.split('@')[0]);
  375 |     await page.fill('#f-last', 'Test');
  376 |     await page.fill('#f-phone', '+212600000002');
  377 | 
  378 |     // Click confirm booking
  379 |     await page.getByTestId('btn:confirm-booking').click();
  380 | 
  381 |     // Wait for booking confirmation
  382 |     await expect(page.getByTestId('step:booking-confirmed')).toBeVisible({ timeout: 15000 });
  383 | 
  384 |     // Verify DB state
  385 |     const count = await countAppointmentsForCustomer(testCustomer.id, testDate);
  386 |     expect(count).toBe(1);
  387 | 
  388 |     // Verify the appointment has the right fields
  389 |     const admin = adminClient();
  390 |     const { data } = await admin
  391 |       .from('appointments')
  392 |       .select('status, preferred_professional_id, professional_id, appointment_date')
  393 |       .eq('customer_id', testCustomer.id)
  394 |       .eq('appointment_date', testDate)
  395 |       .eq('status', 'pending')
  396 |       .single();
  397 | 
  398 |     expect(data).toBeTruthy();
  399 |     expect((data as any).status).toBe('pending');
  400 |     expect((data as any).preferred_professional_id).toBe(barberId);
  401 |     expect((data as any).professional_id).toBeNull();
  402 |   });
  403 | });
  404 | 
```