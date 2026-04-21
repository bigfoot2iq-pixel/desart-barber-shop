# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: booking-details-step.spec.ts >> Booking Details Step — Section 16 >> 16.5 — network failure shows error message
- Location: __tests__\e2e\booking-details-step.spec.ts:220:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Test source

```ts
  153 |     await page.goto('/');
  154 | 
  155 |     await navigateToDetailsStep(page, barberId, serviceId, testDate);
  156 | 
  157 |     // Leave form fields empty
  158 |     await page.fill('#f-first', '');
  159 |     await page.fill('#f-last', '');
  160 |     await page.fill('#f-phone', '');
  161 | 
  162 |     // Confirm button should be disabled
  163 |     const confirmBtn = page.getByTestId('btn:confirm-booking');
  164 |     await expect(confirmBtn).toBeDisabled({ timeout: 10000 });
  165 |   });
  166 | 
  167 |   // 16.2 Phone format: test local Moroccan + international
  168 |   test('16.2 — phone field accepts Moroccan and international formats', async ({
  169 |     authenticatedPage,
  170 |     testCustomer,
  171 |   }) => {
  172 |     const page = authenticatedPage;
  173 |     await page.goto('/');
  174 | 
  175 |     await navigateToDetailsStep(page, barberId, serviceId, testDate);
  176 | 
  177 |     // Test international format
  178 |     await page.fill('#f-first', 'Test');
  179 |     await page.fill('#f-last', 'User');
  180 |     await page.fill('#f-phone', '+212600000003');
  181 | 
  182 |     // Confirm button should be enabled (formComplete = true)
  183 |     const confirmBtn = page.getByTestId('btn:confirm-booking');
  184 |     await expect(confirmBtn).toBeEnabled({ timeout: 10000 });
  185 |   });
  186 | 
  187 |   // 16.3 Google sign-in flow: mock successful sign-in → appointment saves
  188 |   // The auth is already injected via the fixture, so this tests the happy path
  189 |   // where the user is already authenticated.
  190 |   test('16.3 — authenticated user can submit without Google sign-in popup', async ({
  191 |     authenticatedPage,
  192 |     testCustomer,
  193 |   }) => {
  194 |     const page = authenticatedPage;
  195 |     await page.goto('/');
  196 | 
  197 |     await navigateToDetailsStep(page, barberId, serviceId, testDate);
  198 | 
  199 |     // Fill in the contact form
  200 |     await page.fill('#f-first', testCustomer.email.split('@')[0]);
  201 |     await page.fill('#f-last', 'Test');
  202 |     await page.fill('#f-phone', '+212600000004');
  203 | 
  204 |     // Click confirm booking — should not trigger Google sign-in popup
  205 |     await page.getByTestId('btn:confirm-booking').click();
  206 | 
  207 |     // Wait for booking confirmation
  208 |     await expect(page.getByTestId('step:booking-confirmed')).toBeVisible({ timeout: 15000 });
  209 |   });
  210 | 
  211 |   // 16.4 verifyUser returns null (stale JWT) → falls back to signInWithGoogleModal
  212 |   // This path is hard to test in E2E without manipulating the auth state mid-flow.
  213 |   // Mark as todo pending a product decision on how to simulate stale JWT.
  214 |   test('16.4 — stale JWT falls back to Google sign-in (plan item 16.4 — needs auth state manipulation fixture)', () => {
  215 |     test.skip(true, 'todo: not yet implemented');
  216 |   });
  217 | 
  218 |   // 16.5 Network failure mid-persistAppointment → saveError shown, user can retry
  219 |   // This requires mocking the network. Playwright can intercept requests.
  220 |   test('16.5 — network failure shows error message', async ({
  221 |     authenticatedPage,
  222 |     testCustomer,
  223 |   }) => {
  224 |     const page = authenticatedPage;
  225 |     await page.goto('/');
  226 | 
  227 |     // Block the createAppointment RPC call
  228 |     await page.route('**/rest/v1/rpc/**', async (route) => {
  229 |       const url = route.request().url();
  230 |       if (url.includes('create_appointment') || url.includes('get_booked_slots')) {
  231 |         // Only block the appointment creation, not the booked slots fetch
  232 |         if (url.includes('create_appointment')) {
  233 |           await route.abort('failed');
  234 |           return;
  235 |         }
  236 |       }
  237 |       await route.continue();
  238 |     });
  239 | 
  240 |     await navigateToDetailsStep(page, barberId, serviceId, testDate);
  241 | 
  242 |     // Fill in the contact form
  243 |     await page.fill('#f-first', testCustomer.email.split('@')[0]);
  244 |     await page.fill('#f-last', 'Test');
  245 |     await page.fill('#f-phone', '+212600000005');
  246 | 
  247 |     // Click confirm booking
  248 |     await page.getByTestId('btn:confirm-booking').click();
  249 | 
  250 |     // Should show an error message
  251 |     const errorDiv = page.getByTestId('text:booking-error');
  252 |     const isVisible = await errorDiv.isVisible({ timeout: 15000 }).catch(() => false);
> 253 |     expect(isVisible).toBe(true);
      |                       ^ Error: expect(received).toBe(expected) // Object.is equality
  254 |   });
  255 | 
  256 |   // 16.6 Retry after SLOT_TAKEN error → UI shows "That time was just booked"
  257 |   // This requires racing a booking. Complex to set up in E2E.
  258 |   test('16.6 — SLOT_TAKEN retry shows friendly error and re-fetches slots (plan item 16.6 — needs concurrent booking race setup)', () => {
  259 |     test.skip(true, 'todo: not yet implemented');
  260 |   });
  261 | 
  262 |   // 16.7 Profile upsert fails → surface error
  263 |   // Hard to test without breaking the profiles table constraints.
  264 |   test('16.7 — profile upsert failure surfaces error (plan item 16.7 — needs profiles table constraint manipulation)', () => {
  265 |     test.skip(true, 'todo: not yet implemented');
  266 |   });
  267 | });
  268 | 
```