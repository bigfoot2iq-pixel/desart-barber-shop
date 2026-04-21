# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: booking-time-step.spec.ts >> Booking Time Step — double-book regression >> 12.2 — cross-user: slot booked by user A is hidden from user B
- Location: __tests__\e2e\booking-time-step.spec.ts:273:7

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
  245 |       await expect(slot1000).toBeVisible({ timeout: 10000 });
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
> 303 |         await expect(slot1000).toBeVisible({ timeout: 10000 });
      |                                ^ Error: expect(locator).toBeVisible() failed
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
  346 |     }
  347 |   });
  348 | 
  349 |   // -----------------------------------------------------------------------
  350 |   // 12.4 Admin cancel reopens slot
  351 |   //
  352 |   // Seed a pending booking at 09:00. Verify it's hidden. Admin cancels it.
  353 |   // Refresh the page → 09:00 is visible again.
  354 |   // -----------------------------------------------------------------------
  355 |   test('12.4 — admin cancel reopens the slot', async ({
  356 |     authenticatedPage,
  357 |   }) => {
  358 |     const page = authenticatedPage;
  359 | 
  360 |     // Seed a pending booking at 09:00
  361 |     const bookingId = await seedPendingBooking(
  362 |       barberId,
  363 |       testDate,
  364 |       '09:00:00',
  365 |       '09:30:00'
  366 |     );
  367 | 
  368 |     try {
  369 |       await page.goto('/');
  370 |       await navigateToTimeStep(page, barberId, serviceId);
  371 | 
  372 |       // 09:00 must be hidden before cancel
  373 |       const slot0900Before = page.getByTestId('btn:time-09:00');
  374 |       await expect(slot0900Before).not.toBeVisible({ timeout: 10000 });
  375 | 
  376 |       // Admin cancels the booking
  377 |       await cancelBookingAsAdmin(bookingId);
  378 | 
  379 |       // Refresh the page to reload booked slots
  380 |       await page.reload();
  381 |       await navigateToTimeStep(page, barberId, serviceId);
  382 | 
  383 |       // 09:00 should now be visible again
  384 |       const slot0900After = page.getByTestId('btn:time-09:00');
  385 |       await expect(slot0900After).toBeVisible({ timeout: 10000 });
  386 |     } finally {
  387 |       await deleteBookingAsAdmin(bookingId);
  388 |     }
  389 |   });
  390 | 
  391 |   // -----------------------------------------------------------------------
  392 |   // 12.5 Barber fully booked all day → calendar grays out that date
  393 |   // -----------------------------------------------------------------------
  394 |   test('12.5 — barber fully booked all day, date not selectable', async ({
  395 |     authenticatedPage,
  396 |   }) => {
  397 |     const page = authenticatedPage;
  398 | 
  399 |     // Seed bookings covering the entire working day 09:00–17:00 in 30-min blocks
  400 |     const bookingIds: string[] = [];
  401 |     try {
  402 |       for (let h = 9; h < 17; h++) {
  403 |         const start = `${String(h).padStart(2, '0')}:00:00`;
```