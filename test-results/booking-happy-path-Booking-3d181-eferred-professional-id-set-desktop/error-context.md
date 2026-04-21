# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: booking-happy-path.spec.ts >> Booking Happy Path — Section 11 >> 11.7 — DB row created with status=pending, preferred_professional_id set
- Location: __tests__\e2e\booking-happy-path.spec.ts:359:7

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
  277 | 
  278 |     // Select date
  279 |     const dateBtn = page.getByTestId(`btn:date-${testDate}`);
  280 |     await dateBtn.waitFor({ state: 'visible', timeout: 10000 });
  281 |     await dateBtn.scrollIntoViewIfNeeded();
  282 |     await dateBtn.click({ force: true });
  283 |     await page.waitForTimeout(800);
  284 | 
  285 |     // Time picker should show slots
  286 |     const timeSlots = page.locator('[data-testid^="btn:time-"]');
  287 |     await expect(timeSlots.first()).toBeVisible({ timeout: 10000 });
  288 |     const count = await timeSlots.count();
  289 |     expect(count).toBeGreaterThan(0);
  290 |   });
  291 | 
  292 |   // 11.5 Select time → step 5
  293 |   test('11.5 — select time, auto-advance to details step', async ({
  294 |     authenticatedPage,
  295 |   }) => {
  296 |     const page = authenticatedPage;
  297 |     await page.goto('/');
  298 | 
  299 |     await page.getByTestId('btn:open-booking').first().click();
  300 |     await page.waitForSelector('[role="dialog"]', { state: 'visible' });
  301 | 
  302 |     // Navigate to step 4
  303 |     await page.waitForTimeout(500);
  304 |     const locationBtns = page.locator('[data-testid^="btn:location-"]');
  305 |     await locationBtns.first().waitFor({ state: 'visible', timeout: 10000 });
  306 |     await locationBtns.first().click();
  307 |     await page.waitForTimeout(800);
  308 | 
  309 |     const barberBtn = page.getByTestId(`btn:barber-${barberId}`);
  310 |     await barberBtn.waitFor({ state: 'visible', timeout: 10000 });
  311 |     await barberBtn.click();
  312 |     await page.waitForTimeout(800);
  313 | 
  314 |     const serviceBtn = page.getByTestId(`btn:service-${serviceId}`);
  315 |     await serviceBtn.waitFor({ state: 'visible', timeout: 10000 });
  316 |     await serviceBtn.click();
  317 |     await page.waitForTimeout(800);
  318 | 
  319 |     // Select date
  320 |     const dateBtn = page.getByTestId(`btn:date-${testDate}`);
  321 |     await dateBtn.waitFor({ state: 'visible', timeout: 10000 });
  322 |     await dateBtn.scrollIntoViewIfNeeded();
  323 |     await dateBtn.click({ force: true });
  324 |     await page.waitForTimeout(800);
  325 | 
  326 |     // Select first time slot
  327 |     const timeSlots = page.locator('[data-testid^="btn:time-"]');
  328 |     await timeSlots.first().waitFor({ state: 'visible', timeout: 10000 });
  329 |     await timeSlots.first().click();
  330 | 
  331 |     // Auto-advance to step 5
  332 |     await page.waitForTimeout(1000);
  333 |     await expect(page.locator('#panel-title')).toContainText('Your Details');
  334 |   });
  335 | 
  336 |   // 11.6 Fill name/phone → submit → step 6 confirmation
  337 |   test('11.6 — fill details, submit, see confirmation', async ({
  338 |     authenticatedPage,
  339 |     testCustomer,
  340 |   }) => {
  341 |     const page = authenticatedPage;
  342 |     await page.goto('/');
  343 | 
  344 |     await navigateToDetailsStep(page, barberId, serviceId, testDate);
  345 | 
  346 |     // Fill in the contact form
  347 |     await page.fill('#f-first', testCustomer.email.split('@')[0]);
  348 |     await page.fill('#f-last', 'Test');
  349 |     await page.fill('#f-phone', '+212600000001');
  350 | 
  351 |     // Click confirm booking
  352 |     await page.getByTestId('btn:confirm-booking').click();
  353 | 
  354 |     // Wait for booking confirmation
  355 |     await expect(page.getByTestId('step:booking-confirmed')).toBeVisible({ timeout: 15000 });
  356 |   });
  357 | 
  358 |   // 11.7 appointments row exists in DB with correct fields
  359 |   test('11.7 — DB row created with status=pending, preferred_professional_id set', async ({
  360 |     authenticatedPage,
  361 |     testCustomer,
  362 |   }) => {
  363 |     const page = authenticatedPage;
  364 |     await page.goto('/');
  365 | 
  366 |     await navigateToDetailsStep(page, barberId, serviceId, testDate);
  367 | 
  368 |     // Fill in the contact form
  369 |     await page.fill('#f-first', testCustomer.email.split('@')[0]);
  370 |     await page.fill('#f-last', 'Test');
  371 |     await page.fill('#f-phone', '+212600000002');
  372 | 
  373 |     // Click confirm booking
  374 |     await page.getByTestId('btn:confirm-booking').click();
  375 | 
  376 |     // Wait for booking confirmation
> 377 |     await expect(page.getByTestId('step:booking-confirmed')).toBeVisible({ timeout: 15000 });
      |                                                              ^ Error: expect(locator).toBeVisible() failed
  378 | 
  379 |     // Verify DB state
  380 |     const count = await countAppointmentsForCustomer(testCustomer.id, testDate);
  381 |     expect(count).toBe(1);
  382 | 
  383 |     // Verify the appointment has the right fields
  384 |     const admin = adminClient();
  385 |     const { data } = await admin
  386 |       .from('appointments')
  387 |       .select('status, preferred_professional_id, professional_id, appointment_date')
  388 |       .eq('customer_id', testCustomer.id)
  389 |       .eq('appointment_date', testDate)
  390 |       .eq('status', 'pending')
  391 |       .single();
  392 | 
  393 |     expect(data).toBeTruthy();
  394 |     expect((data as any).status).toBe('pending');
  395 |     expect((data as any).preferred_professional_id).toBe(barberId);
  396 |     expect((data as any).professional_id).toBeNull();
  397 |   });
  398 | });
  399 | 
```