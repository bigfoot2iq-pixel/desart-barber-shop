# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: booking-time-step.spec.ts >> Booking Time Step — double-book regression >> 12.4 — admin cancel reopens the slot
- Location: __tests__\e2e\booking-time-step.spec.ts:355:7

# Error details

```
Error: seedBooking failed: insert or update on table "appointments" violates foreign key constraint "appointments_customer_id_fkey"
```

# Test source

```ts
  1   | import { test, expect } from './fixtures';
  2   | import { createClient } from '@supabase/supabase-js';
  3   | 
  4   | const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  5   | const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  6   | 
  7   | /**
  8   |  * booking-time-step.spec.ts
  9   |  *
  10  |  * Section 12 of the booking test plan — the critical step.
  11  |  * Cases 12.1–12.4: double-book regression, cross-user conflict,
  12  |  * duration conflict, and admin-cancel-reopens-slot.
  13  |  */
  14  | 
  15  | // ---------------------------------------------------------------------------
  16  | // Helpers
  17  | // ---------------------------------------------------------------------------
  18  | 
  19  | function todayStr(): string {
  20  |   const d = new Date();
  21  |   return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  22  | }
  23  | 
  24  | function tomorrowStr(): string {
  25  |   const d = new Date();
  26  |   d.setDate(d.getDate() + 1);
  27  |   return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  28  | }
  29  | 
  30  | function adminClient() {
  31  |   return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  32  |     auth: { persistSession: false, autoRefreshToken: false },
  33  |   });
  34  | }
  35  | 
  36  | async function getActiveSalonId(): Promise<string> {
  37  |   const admin = adminClient();
  38  |   const { data, error } = await admin
  39  |     .from('salons')
  40  |     .select('id')
  41  |     .eq('is_active', true)
  42  |     .limit(1);
  43  |   if (error || !data || data.length === 0) {
  44  |     throw new Error('No active salon found for E2E tests');
  45  |   }
  46  |   return data[0].id;
  47  | }
  48  | 
  49  | async function getActiveBarberId(): Promise<string> {
  50  |   const admin = adminClient();
  51  |   const { data, error } = await admin
  52  |     .from('professionals')
  53  |     .select('id')
  54  |     .eq('is_active', true)
  55  |     .limit(1);
  56  |   if (error || !data || data.length === 0) {
  57  |     throw new Error('No active professional found for E2E tests');
  58  |   }
  59  |   return data[0].id;
  60  | }
  61  | 
  62  | async function seedPendingBooking(
  63  |   barberId: string,
  64  |   date: string,
  65  |   start: string,
  66  |   end: string,
  67  |   customerId?: string
  68  | ): Promise<string> {
  69  |   const admin = adminClient();
  70  |   const salonId = await getActiveSalonId();
  71  |   const { data, error } = await admin
  72  |     .from('appointments')
  73  |     .insert({
  74  |       customer_id: customerId ?? '00000000-0000-0000-0000-000000000000',
  75  |       appointment_date: date,
  76  |       start_time: start,
  77  |       end_time: end,
  78  |       location_type: 'salon',
  79  |       salon_id: salonId,
  80  |       home_address: null,
  81  |       home_latitude: null,
  82  |       home_longitude: null,
  83  |       payment_method: 'cash',
  84  |       status: 'pending',
  85  |       total_price_mad: 100,
  86  |       notes: null,
  87  |       professional_id: null,
  88  |       preferred_professional_id: barberId,
  89  |     })
  90  |     .select('id')
  91  |     .single();
  92  |   if (error || !data) {
> 93  |     throw new Error(`seedBooking failed: ${error?.message ?? 'no row'}`);
      |           ^ Error: seedBooking failed: insert or update on table "appointments" violates foreign key constraint "appointments_customer_id_fkey"
  94  |   }
  95  |   return data.id;
  96  | }
  97  | 
  98  | async function cancelBookingAsAdmin(appointmentId: string): Promise<void> {
  99  |   const admin = adminClient();
  100 |   await admin
  101 |     .from('appointments')
  102 |     .update({ status: 'cancelled' })
  103 |     .eq('id', appointmentId);
  104 | }
  105 | 
  106 | async function deleteBookingAsAdmin(appointmentId: string): Promise<void> {
  107 |   const admin = adminClient();
  108 |   await admin.from('appointments').delete().eq('id', appointmentId);
  109 | }
  110 | 
  111 | async function seedWeeklyAvailabilityForBarber(barberId: string): Promise<void> {
  112 |   const admin = adminClient();
  113 |   // Mon(1)–Sat(6) 09:00–17:00, Sun(0) off
  114 |   const rows = [];
  115 |   for (let day = 1; day <= 6; day++) {
  116 |     rows.push({
  117 |       professional_id: barberId,
  118 |       day_of_week: day,
  119 |       start_time: '09:00',
  120 |       end_time: '17:00',
  121 |       is_available: true,
  122 |     });
  123 |   }
  124 |   const { error } = await admin.from('professional_availability').insert(rows);
  125 |   if (error) throw new Error(`seedWeeklyAvailability failed: ${error.message}`);
  126 | }
  127 | 
  128 | async function clearWeeklyAvailability(barberId: string): Promise<void> {
  129 |   const admin = adminClient();
  130 |   await admin.from('professional_availability').delete().eq('professional_id', barberId);
  131 | }
  132 | 
  133 | // ---------------------------------------------------------------------------
  134 | // Navigate through the booking flow to step 4 (date/time selection)
  135 | // ---------------------------------------------------------------------------
  136 | 
  137 | async function navigateToTimeStep(
  138 |   page: import('@playwright/test').Page,
  139 |   barberId: string,
  140 |   serviceId: string
  141 | ): Promise<void> {
  142 |   // Click "Reserve a chair" to open the booking modal
  143 |   await page.getByTestId('btn:open-booking').first().click();
  144 | 
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
```