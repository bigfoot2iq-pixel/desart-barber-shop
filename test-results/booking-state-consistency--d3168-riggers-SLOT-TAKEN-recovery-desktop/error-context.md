# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: booking-state-consistency.spec.ts >> Booking State Consistency — Section 17 >> 17.3 — concurrent booking by another user triggers SLOT_TAKEN recovery
- Location: __tests__\e2e\booking-state-consistency.spec.ts:225:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByTestId('text:booking-error')
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for getByTestId('text:booking-error')

```

# Test source

```ts
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
  233 |     const { createTestCustomer, deleteTestUser } = await import('./fixtures');
  234 |     const otherCustomer = await createTestCustomer('concurrent-booking');
  235 | 
  236 |     try {
  237 |       await page.goto('/');
  238 | 
  239 |       // Navigate to details step (step 5) but don't submit yet
  240 |       await navigateToDetailsStep(page, barberId, serviceId, testDate);
  241 | 
  242 |       // Get the first available time slot
  243 |       const timeSlots = page.locator('[data-testid^="btn:time-"]');
  244 |       const firstSlotText = await timeSlots.first().textContent();
  245 | 
  246 |       if (!firstSlotText) return;
  247 | 
  248 |       // Parse the time slot (format: "HH:MM")
  249 |       const timeStr = firstSlotText.trim();
  250 |       const startParts = timeStr.split(':');
  251 |       const startHour = parseInt(startParts[0], 10);
  252 |       const startMin = parseInt(startParts[1], 10);
  253 | 
  254 |       // Seed a booking for the other customer at the same time
  255 |       // We need to know the duration — get it from the service
  256 |       const { data: serviceData } = await admin
  257 |         .from('services')
  258 |         .select('duration_minutes')
  259 |         .eq('id', serviceId)
  260 |         .single();
  261 |       const duration = serviceData ? (serviceData as any).duration_minutes : 30;
  262 | 
  263 |       const endHour = startHour + Math.floor((startMin + duration) / 60);
  264 |       const endMin = (startMin + duration) % 60;
  265 |       const startTime = `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}:00`;
  266 |       const endTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}:00`;
  267 | 
  268 |       const { data: salonData } = await admin
  269 |         .from('salons')
  270 |         .select('id')
  271 |         .eq('is_active', true)
  272 |         .limit(1)
  273 |         .single();
  274 | 
  275 |       await admin.from('appointments').insert({
  276 |         customer_id: otherCustomer.id,
  277 |         appointment_date: testDate,
  278 |         start_time: startTime,
  279 |         end_time: endTime,
  280 |         location_type: 'salon',
  281 |         salon_id: (salonData as any).id,
  282 |         home_address: null,
  283 |         home_latitude: null,
  284 |         home_longitude: null,
  285 |         payment_method: 'cash',
  286 |         status: 'pending',
  287 |         total_price_mad: 100,
  288 |         notes: null,
  289 |         professional_id: null,
  290 |         preferred_professional_id: barberId,
  291 |       });
  292 | 
  293 |       // Now fill and submit — should hit SLOT_TAKEN
  294 |       await page.fill('#f-first', testCustomer.email.split('@')[0]);
  295 |       await page.fill('#f-last', 'Test');
  296 |       await page.fill('#f-phone', `+2126${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`);
  297 |       await page.getByTestId('btn:confirm-booking').click();
  298 | 
  299 |       // Should show the "That time was just booked" error
> 300 |       await expect(page.getByTestId('text:booking-error')).toBeVisible({ timeout: 15000 });
      |                                                            ^ Error: expect(locator).toBeVisible() failed
  301 |       const errorText = await page.getByTestId('text:booking-error').textContent();
  302 |       expect(errorText).toContain('booked');
  303 |     } finally {
  304 |       await deleteTestUser(otherCustomer.id);
  305 |     }
  306 |   });
  307 | 
  308 |   // Additional: Idempotency / double-click submit
  309 |   // Relates to "Things you aren't paying attention to" #10
  310 |   test('17.4 — idempotency: double-click submit creates exactly one row (plan item 17.4, attention list #10 — needs idempotency key or unique constraint)', () => {
  311 |     test.skip(true, 'todo: not yet implemented');
  312 |   });
  313 | 
  314 |   // Additional: Spanning midnight
  315 |   // Relates to "Things you aren't paying attention to" #11
  316 |   test('17.5 — spanning midnight: service ending after 23:59 produces zero slots, not DB error (plan item 17.5, attention list #11 — product decision on late-night services)', () => {
  317 |     test.skip(true, 'todo: not yet implemented');
  318 |   });
  319 | });
  320 | 
```