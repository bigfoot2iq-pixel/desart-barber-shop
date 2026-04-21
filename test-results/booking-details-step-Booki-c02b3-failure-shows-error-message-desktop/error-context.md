# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: booking-details-step.spec.ts >> Booking Details Step — Section 16 >> 16.5 — network failure shows error message
- Location: __tests__\e2e\booking-details-step.spec.ts:222:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Test source

```ts
  155 |     await page.goto('/');
  156 | 
  157 |     await navigateToDetailsStep(page, barberId, serviceId, testDate);
  158 | 
  159 |     // Leave form fields empty
  160 |     await page.fill('#f-first', '');
  161 |     await page.fill('#f-last', '');
  162 |     await page.fill('#f-phone', '');
  163 | 
  164 |     // Confirm button should not be visible (AnimatePresence-gated)
  165 |     const confirmBtn = page.getByTestId('btn:confirm-booking');
  166 |     await expect(confirmBtn).toHaveCount(0, { timeout: 10000 });
  167 |   });
  168 | 
  169 |   // 16.2 Phone format: test local Moroccan + international
  170 |   test('16.2 — phone field accepts Moroccan and international formats', async ({
  171 |     authenticatedPage,
  172 |     testCustomer,
  173 |   }) => {
  174 |     const page = authenticatedPage;
  175 |     await page.goto('/');
  176 | 
  177 |     await navigateToDetailsStep(page, barberId, serviceId, testDate);
  178 | 
  179 |     // Test international format
  180 |     await page.fill('#f-first', 'Test');
  181 |     await page.fill('#f-last', 'User');
  182 |     await page.fill('#f-phone', '+212600000003');
  183 | 
  184 |     // Confirm button should be enabled (formComplete = true)
  185 |     const confirmBtn = page.getByTestId('btn:confirm-booking');
  186 |     await expect(confirmBtn).toBeEnabled({ timeout: 10000 });
  187 |   });
  188 | 
  189 |   // 16.3 Google sign-in flow: mock successful sign-in → appointment saves
  190 |   // The auth is already injected via the fixture, so this tests the happy path
  191 |   // where the user is already authenticated.
  192 |   test('16.3 — authenticated user can submit without Google sign-in popup', async ({
  193 |     authenticatedPage,
  194 |     testCustomer,
  195 |   }) => {
  196 |     const page = authenticatedPage;
  197 |     await page.goto('/');
  198 | 
  199 |     await navigateToDetailsStep(page, barberId, serviceId, testDate);
  200 | 
  201 |     // Fill in the contact form
  202 |     await page.fill('#f-first', testCustomer.email.split('@')[0]);
  203 |     await page.fill('#f-last', 'Test');
  204 |     await page.fill('#f-phone', '+212600000004');
  205 | 
  206 |     // Click confirm booking — should not trigger Google sign-in popup
  207 |     await page.getByTestId('btn:confirm-booking').click();
  208 | 
  209 |     // Wait for booking confirmation
  210 |     await expect(page.getByTestId('step:booking-confirmed')).toBeVisible({ timeout: 15000 });
  211 |   });
  212 | 
  213 |   // 16.4 verifyUser returns null (stale JWT) → falls back to signInWithGoogleModal
  214 |   // This path is hard to test in E2E without manipulating the auth state mid-flow.
  215 |   // Mark as todo pending a product decision on how to simulate stale JWT.
  216 |   test('16.4 — stale JWT falls back to Google sign-in (plan item 16.4 — needs auth state manipulation fixture)', () => {
  217 |     test.skip(true, 'todo: not yet implemented');
  218 |   });
  219 | 
  220 |   // 16.5 Network failure mid-persistAppointment → saveError shown, user can retry
  221 |   // This requires mocking the network. Playwright can intercept requests.
  222 |   test('16.5 — network failure shows error message', async ({
  223 |     authenticatedPage,
  224 |     testCustomer,
  225 |   }) => {
  226 |     const page = authenticatedPage;
  227 |     await page.goto('/');
  228 | 
  229 |     // Block the createAppointment RPC call
  230 |     await page.route('**/rest/v1/rpc/**', async (route) => {
  231 |       const url = route.request().url();
  232 |       if (url.includes('create_appointment') || url.includes('get_booked_slots')) {
  233 |         // Only block the appointment creation, not the booked slots fetch
  234 |         if (url.includes('create_appointment')) {
  235 |           await route.abort('failed');
  236 |           return;
  237 |         }
  238 |       }
  239 |       await route.continue();
  240 |     });
  241 | 
  242 |     await navigateToDetailsStep(page, barberId, serviceId, testDate);
  243 | 
  244 |     // Fill in the contact form
  245 |     await page.fill('#f-first', testCustomer.email.split('@')[0]);
  246 |     await page.fill('#f-last', 'Test');
  247 |     await page.fill('#f-phone', '+212600000005');
  248 | 
  249 |     // Click confirm booking
  250 |     await page.getByTestId('btn:confirm-booking').click();
  251 | 
  252 |     // Should show an error message
  253 |     const errorDiv = page.getByTestId('text:booking-error');
  254 |     const isVisible = await errorDiv.isVisible({ timeout: 15000 }).catch(() => false);
> 255 |     expect(isVisible).toBe(true);
      |                       ^ Error: expect(received).toBe(expected) // Object.is equality
  256 |   });
  257 | 
  258 |   // 16.6 Retry after SLOT_TAKEN error → UI shows "That time was just booked"
  259 |   // This requires racing a booking. Complex to set up in E2E.
  260 |   test('16.6 — SLOT_TAKEN retry shows friendly error and re-fetches slots (plan item 16.6 — needs concurrent booking race setup)', () => {
  261 |     test.skip(true, 'todo: not yet implemented');
  262 |   });
  263 | 
  264 |   // 16.7 Profile upsert fails → surface error
  265 |   // Hard to test without breaking the profiles table constraints.
  266 |   test('16.7 — profile upsert failure surfaces error (plan item 16.7 — needs profiles table constraint manipulation)', () => {
  267 |     test.skip(true, 'todo: not yet implemented');
  268 |   });
  269 | });
  270 | 
```