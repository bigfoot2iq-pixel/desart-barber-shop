# Booking Flow — Test Plan

End-to-end test plan for the customer booking flow (Home → Booking modal, steps 1–5) and its persistence path (`createAppointment` + RPC + DB constraints).

## Scope & layers

Three layers, each with its own file convention:

| Layer | Location | Runner | Purpose |
|---|---|---|---|
| Unit (pure functions) | `__tests__/unit/*.test.ts` | Jest (node env) | `buildTimeSlots`, `getWorkingHoursForDate`, `buildDateSlots`, `toMinutes/toHHMM/toHHMMSS`, `haversineKm` |
| DB/integration (RLS, RPC, constraints) | `__tests__/booking/*.test.ts` | Jest + live Supabase via service-role key (pattern from `__tests__/security/helpers.ts`) | `get_barber_booked_slots` RPC, `appointments_no_barber_overlap` EXCLUDE constraint, availability-override behaviour |
| E2E (full UI flow) | `__tests__/e2e/*.spec.ts` | Playwright (add as new dep) | Booking modal steps 1–5, form validation, modal state after success, error handling, back-button behaviour |

Unit tests must NOT hit the network. DB tests are gated behind `hasServiceRole` (same guard as existing security suite). E2E tests run against a seeded test database — never prod.

---

## Pre-requisites

Before writing tests, add two test helpers:

1. **`__tests__/booking/helpers.ts`** — reuse `createTestCustomer`, `adminClient`, `anonClient` from `__tests__/security/helpers.ts`. Add:
   - `seedWeeklyAvailability(professionalId, daysConfig)` — inserts `professional_availability` rows via admin client.
   - `seedOverride(professionalId, date, { isAvailable, start, end })`.
   - `seedBooking({ barberId, date, start, end, status, assigned })` — inserts into `appointments`; `assigned=true` sets `professional_id`, otherwise only `preferred_professional_id`.
   - `clearBookingsFor(barberIds, dateFrom, dateTo)` — cleanup.
   - `callRpcAsAnon(barberIds, from, to)` / `callRpcAsCustomer(client, ...)`.
2. **Playwright fixture** that wires a disposable test user + mocks Google sign-in.

---

## Unit tests — `__tests__/unit/build-time-slots.test.ts`

The function lives in `app/page.tsx:172-186`. Extract it (plus `toMinutes`/`toHHMM`/`getWorkingHoursForDate`) to `lib/booking/slots.ts` so it's importable from tests without mounting React.

### 1. `buildTimeSlots`

| # | Case | Expected |
|---|---|---|
| 1.1 | `hours=null` | returns `[]` |
| 1.2 | `durationMin <= 0` | returns `[]` |
| 1.3 | Full empty day (09:00–17:00, 30 min) | 16 slots starting 09:00 through 16:30 |
| 1.4 | Service duration > working window (e.g. 9h service in 8h day) | `[]` |
| 1.5 | Service duration exactly equals window | one slot at `hours.start` |
| 1.6 | Booking 09:00–09:30 with 30 min service | `09:00` hidden, `09:30` visible |
| 1.7 | Booking 09:00–10:00 with 30 min service | `09:00` and `09:30` hidden, `10:00` visible |
| 1.8 | **Service of 60 min starting at 09:00 clashes with 09:30 booking** | `09:00` hidden (start<bookingEnd && start+60>bookingStart) |
| 1.9 | Back-to-back bookings 09:00–09:30 and 09:30–10:00 | `09:00`, `09:30` hidden, `10:00` visible (closed-open interval) |
| 1.10 | Booking ends exactly at `hours.end` | last slot correctly hidden |
| 1.11 | Booking starts before `hours.start` (edge/dirty data) | earliest slots that still fit are returned |
| 1.12 | Multiple overlapping bookings | union of all blocked ranges is excluded |
| 1.13 | `SLOT_STEP_MINUTES = 30`, service duration 45 min | slots advance by 30 but each checks 45-min window |
| 1.14 | Huge booking list (100+ entries) | still linear, no crash |

### 2. `getWorkingHoursForDate`

| # | Case | Expected |
|---|---|---|
| 2.1 | No override + weekly row for Monday | returns weekly Monday hours |
| 2.2 | No override + weekly row with `is_available=false` | `null` |
| 2.3 | No override + weekly missing (barber off that weekday) | `null` |
| 2.4 | Override with `is_available=false` | `null` even if weekly says open |
| 2.5 | Override with shorter hours (e.g. 13:00–17:00) on a normally 09:00–18:00 day | returns 13:00–17:00 |
| 2.6 | Override with `is_available=true` on a weekly-off day (one-off opening) | returns override hours |
| 2.7 | Override with `start_time=null, end_time=null, is_available=true` | DB CHECK rejects — never reaches function |
| 2.8 | Day-of-week computed from `${dateStr}T12:00:00` | DST days (spring-forward/fall-back): confirm no off-by-one — use dates that cross DST in Morocco (test `2026-03-29`, `2026-10-25`). Noon anchor should keep the correct weekday in local tz. |

### 3. Date / time helpers

Quick sanity tests for `toMinutes`, `toHHMM`, `toHHMMSS`:

- `toMinutes("09:30")` → 570
- `toHHMM(570)` → `"09:30"`
- `toMinutes("09:30:00")` → 570 (ignores seconds; currently works via split — pin with a test so refactors don't break it)
- `toHHMMSS("09:30")` → `"09:30:00"`
- Round-trip: `toHHMM(toMinutes(x)) === x` for `x ∈ {00:00, 09:00, 23:30}`
- `toMinutes("24:00")` — explicitly document behaviour; if unsupported, add input validation.

### 4. `buildDateSlots`

- Returns `BOOKING_WINDOW_DAYS` entries.
- Starts from **tomorrow** (loop is `i=1` through `BOOKING_WINDOW_DAYS`) — today is NOT in the list. Flag if the product expects same-day booking.
- Date IDs are in `YYYY-MM-DD` local-time format, not UTC.
- Mock `Date` so the test is deterministic (use Jest fake timers set to `2026-06-15`).
- Cross-month-boundary test: anchor at `2026-01-25`, verify Feb dates appear correctly.
- Cross-year test: anchor at `2026-12-20`, verify 2027 dates appear.
- Leap-year: `2028-02-28` + 1 day = `2028-02-29`.

### 5. `haversineKm`

- Same point → 0.
- Known pair (Casablanca ↔ Agadir) within 5% of 460 km.
- Antipodal → ~20000 km (sanity bound).

---

## DB/integration tests — `__tests__/booking/`

### 6. `get-barber-booked-slots-rpc.test.ts`

Seeds rows via admin client, calls the RPC as anon and as authenticated customer. The RPC is the sole source of truth for availability — if these break, the UI double-books.

| # | Seed state | Call | Expected |
|---|---|---|---|
| 6.1 | Pending appointment, `professional_id=NULL`, `preferred_professional_id=B`, date=D | `get_barber_booked_slots([B], D, D)` as anon | one row returned with `barber_id=B` |
| 6.2 | Same as 6.1 | Same call as a *different* authenticated customer | one row returned (RLS bypass via SECURITY DEFINER) |
| 6.3 | Confirmed appointment with `professional_id=B` (admin-assigned) | anon call | one row returned |
| 6.4 | **Cancelled** appointment for barber B | anon call | zero rows |
| 6.5 | **Completed** appointment for barber B (past) | anon call | zero rows |
| 6.6 | Multiple barbers, pending rows for each | call with `[B1, B2]` | both rows returned, correctly keyed by `barber_id` |
| 6.7 | Date outside `[from, to]` | call with narrower range | row excluded |
| 6.8 | `p_barber_ids = []` | call | empty array, no error |
| 6.9 | `p_barber_ids = [<nonexistent uuid>]` | call | empty array |
| 6.10 | Response shape | call | columns exactly `barber_id, appointment_date, start_time, end_time` — no PII (no `customer_id`, `notes`, `total_price_mad`, etc.). Fail if future migrations leak columns. |
| 6.11 | `search_path` hardening | call after `SET search_path=''` on the session | still works (function declares `SET search_path = public`) |
| 6.12 | Permissions | grant list inspection: only `anon, authenticated` execute. No `public`. |

### 7. `appointments-overlap-constraint.test.ts`

Tests the `appointments_no_barber_overlap` EXCLUDE constraint from `014_booked_slots_and_overlap_guard.sql`. Admin client inserts directly to bypass RLS so we isolate the constraint.

| # | Seed | Insert attempt | Expected |
|---|---|---|---|
| 7.1 | Pending 09:00–09:30, `preferred=B` | Another pending 09:00–09:30 for same `preferred=B` | **`23P01` raised** |
| 7.2 | Pending 09:00–10:00, `preferred=B` | Pending 09:30–10:00 for same `preferred=B` (overlap middle) | `23P01` |
| 7.3 | Pending 09:00–10:00, `preferred=B` | Pending 10:00–10:30 (touches end, closed-open) | **succeeds** — `[)` range |
| 7.4 | Pending 09:00–09:30, `preferred=B` | Pending 08:30–09:00 (touches start) | succeeds |
| 7.5 | Same barber, different dates | Overlap time-of-day but different `appointment_date` | succeeds |
| 7.6 | `professional_id=B` assigned + pending `preferred_professional_id=B` overlap | Admin assigns appointment; another insert with `preferred=B` overlaps | `23P01` — COALESCE key matches |
| 7.7 | Cancelled 09:00–09:30, `preferred=B` | New pending 09:00–09:30 for same `preferred=B` | succeeds — partial constraint filters out cancelled |
| 7.8 | Completed 09:00–09:30, `preferred=B` | New pending same slot | succeeds |
| 7.9 | Status flip: pending → cancelled | After flip, insert same slot | succeeds (re-evaluates on UPDATE) |
| 7.10 | Status flip: cancelled → pending | If there's already a pending overlap, the UPDATE must fail | `23P01` |
| 7.11 | Different barbers, same slot | Two pending with different `preferred` | succeeds |
| 7.12 | Both `professional_id` and `preferred_professional_id` NULL | Two such inserts overlapping | both succeed — COALESCE is NULL, NULL is never equal to NULL in EXCLUDE. Document this; consider adding a CHECK (`professional_id IS NOT NULL OR preferred_professional_id IS NOT NULL`) if business rules require. |
| 7.13 | **Race condition** | `Promise.all([insertA, insertB])` with same barber/time | exactly one succeeds, one gets `23P01` |

### 8. `createAppointment-error-mapping.test.ts`

Tests `lib/queries/appointments.ts:createAppointment`:

- 8.1 Happy path: returns the inserted `Appointment`.
- 8.2 Double-book triggers `23P01` → function throws `Error('SLOT_TAKEN')` with exactly that message (UI depends on string match at `app/page.tsx`).
- 8.3 Other PG error (e.g. bad FK) → re-thrown as-is, not as `SLOT_TAKEN`.
- 8.4 `appointment_services` insert fails → document behaviour (currently appointment row is orphaned; consider wrapping in an RPC to make it atomic — note in test with `// TODO`).

### 9. `availability-overrides.test.ts`

End-to-end: seed weekly + override rows via admin, call RPC for booked slots, then compute availability with `getWorkingHoursForDate` + `buildTimeSlots`. Confirms the UI logic sees overrides correctly.

| # | Scenario |
|---|---|
| 9.1 | Barber normally Mon 09:00–18:00, override sets that specific Monday to `is_available=false` → `availableTimeSlots=[]`, date hidden in calendar. |
| 9.2 | Sunday (weekly-off) + override open 10:00–14:00 → slots only 10:00–13:30 (with 30 min service). |
| 9.3 | Weekly 09:00–18:00, override 13:00–17:00 → slots start at 13:00, not 09:00. |
| 9.4 | Override for a date outside the 30-day booking window → has no visible effect. |
| 9.5 | Override `start_time >= end_time` → blocked by DB CHECK constraint (verify insert fails). |
| 9.6 | Override that creates zero valid slots for the selected service duration → date hidden from the day picker (`availableDateIds` correctness). |

### 10. RLS-boundary regressions (`__tests__/booking/rls-availability.test.ts`)

The RPC is SECURITY DEFINER so it sees everything, but the rest of the appointment table must still respect RLS. Verify the fix didn't accidentally open a hole.

- 10.1 Anon calling `SELECT * FROM appointments` → `PGRST`/empty (unchanged).
- 10.2 Customer A reading Customer B's appointment directly → blocked.
- 10.3 RPC from customer A returns booked slots for other customers → allowed (expected — no PII).
- 10.4 RPC column list matches exactly `{barber_id, appointment_date, start_time, end_time}` — assert no extra properties leak from future schema changes.

---

## E2E tests — `__tests__/e2e/`

Use Playwright. Each scenario seeds DB state via admin client in `beforeEach`, then drives the UI.

### 11. `booking-happy-path.spec.ts`

- 11.1 Open modal → step 1. Select a salon → step 2 auto-advances? (Check actual behaviour — if there's an explicit Next button, click it.)
- 11.2 Select barber → step 3.
- 11.3 Select one service → step 4; verify `totalDurationMinutes` reflects service duration.
- 11.4 Select date with open availability → time picker shows slots.
- 11.5 Select time → step 5.
- 11.6 Fill name/phone → submit → step 6 confirmation.
- 11.7 `appointments` row exists in DB with `status='pending'`, `preferred_professional_id=<chosen>`, `professional_id=null`, `start_time`, `end_time=start+duration`.

### 12. `booking-time-step.spec.ts` — the critical step

- 12.1 **Double-book repro (the bug that started this)**: seed a pending unassigned booking at 09:00 for barber B today. As the same user, open booking flow → pick B → pick today → 09:00 must NOT appear. Pick 10:00 → submit → success.
- 12.2 Cross-user: customer A holds a 09:00 pending. Customer B opens flow for same barber/day → 09:00 hidden.
- 12.3 Service-duration conflict: existing 09:00–09:30 booking, user picks a 60 min service → 09:00 hidden, 09:30 hidden (end at 10:30 overlaps nothing — visible), 10:00 visible.
- 12.4 Admin cancels a pending booking → UI (refreshed) reopens that slot.
- 12.5 Barber fully booked all day → calendar grays out that date.
- 12.6 Barber's weekly off day → date not selectable.
- 12.7 Override closes a previously-open day → date gets disabled without refresh if user was mid-flow? Document current behaviour; likely stale until modal reopened.
- 12.8 Duration switching: user picks time → goes back → adds a second service → returns to time. Previously-selected time may now conflict. `effectiveSelectedTime` in `app/page.tsx:292-295` should clear if no longer in `availableTimeSlots` — assert.
- 12.9 Past-time guard: today's date at 4 PM — 09:00 slot still shows (no past-time filter exists today). **Flag as a bug** unless intentional. Add a test that reflects desired behaviour.
- 12.10 Service longer than working window → no slots, user sees empty state message.
- 12.11 `BOOKING_WINDOW_DAYS=30` — day 31 is not offered.

### 13. `booking-location-step.spec.ts`

- 13.1 Salon mode: only salons offering active professionals appear (or all — document).
- 13.2 Home mode: requires a pin. Submit without pin → blocked.
- 13.3 Home mode: only barbers with `offers_home_visit=true` listed in step 2.
- 13.4 "Nearby" toggle orders salons by `haversineKm` from user geo.
- 13.5 Geo permission denied → friendly error, user can still pick manually.

### 14. `booking-barber-step.spec.ts`

- 14.1 `nextAvailableByBarber` label appears correctly under each barber card.
- 14.2 Barber with no services compatible with earlier selection → hidden/disabled.
- 14.3 Selecting a barber whose services don't include previously picked services → `effectiveSelectedServices` filters correctly (see `app/page.tsx:245-249`).

### 15. `booking-service-step.spec.ts`

- 15.1 Multi-select services → total price sums, total duration sums.
- 15.2 Zero services → next button disabled.
- 15.3 Toggling a service off updates totals instantly.

### 16. `booking-details-step.spec.ts`

- 16.1 Submit without name/phone → validation blocks (`formComplete` in page.tsx).
- 16.2 Phone format: test local Moroccan + international. Document accepted formats.
- 16.3 Google sign-in flow: mock successful sign-in → appointment saves.
- 16.4 `verifyUser` returns null (stale JWT) → falls back to `signInWithGoogleModal` (see page.tsx:806-814). Mock this path.
- 16.5 Network failure mid-`persistAppointment` → `saveError` shown, user can retry without losing draft.
- 16.6 Retry after `SLOT_TAKEN` error → UI shows "That time was just booked", time step re-fetches, user re-picks, submit succeeds.
- 16.7 Profile upsert fails → surface error (must not silently proceed — `updateProfile` in `persistAppointment` throws).

### 17. State/consistency after success

- 17.1 After success, modal closes → reopen → `bookingsInRange` reflects the just-created row (the refetch added in `persistAppointment` at `app/page.tsx:791+`).
- 17.2 Booking the same slot a second time without closing the modal → second attempt blocked by constraint + friendly error.
- 17.3 Browser tab left open an hour, another user books the same slot → current user's submit hits `SLOT_TAKEN`, UI recovers.

---

## Things you probably aren't paying attention to

Add tests that exercise each of these explicitly — they are easy to regress:

1. **Timezone drift.** `appointment_date` is `DATE`, `start_time` is `TIME` (no tz). All comparisons assume the Supabase Postgres server timezone matches the user's. If the deploy region is UTC but customers are in Africa/Casablanca (UTC+1, DST), a `today` computed in the browser (`new Date()`) can be a different calendar day than the DB sees at query time near midnight. Write one test that freezes clock at `23:55 local` and confirms `getBookedSlotsInRange(..., today, today+30)` still returns rows.
2. **DST.** Morocco observes DST; the `new Date(\`${dateStr}T12:00:00\`)` trick in `getWorkingHoursForDate` is specifically chosen to survive DST, but pin it with the two transition days each year.
3. **No same-day bookings today.** `buildDateSlots` starts at `i=1` (tomorrow). Product should confirm this is intentional. If not, fix + add test.
4. **No past-time filter.** At 14:00 today, `availableTimeSlots` still offers 09:00. Decide: either hide past times or disable same-day (see #3).
5. **Service/barber deactivation after slot seeded.** If a barber is soft-deactivated (`is_active=false`) while a customer has the flow open, can the submit still insert? Test the submit path — front-end filters `is_active`, but the `appointments` insert has no such constraint. Consider a CHECK or trigger.
6. **Service duration changed by admin mid-flow.** User picked a 30 min slot; admin changes the service to 60 min before the submit. The draft's `durationMinutes` is captured at pick time, so `end_time` is computed from stale data. Decide: revalidate on submit (RPC that recomputes), or accept the snapshot. Add a test pinning the chosen behaviour.
7. **Service price changed mid-flow.** Same concern — `total_price_mad` is captured from client. Needs server-side revalidation if you care about revenue correctness. Add a test.
8. **Service-override interactions.** Admin deletes/re-adds the service after draft creation; `serviceIds` in the draft may FK-fail. Test.
9. **Appointment_services partial failure.** In `createAppointment`, if the appointment insert succeeds but `appointment_services` insert fails, you have an appointment with no services. Wrap in an RPC or add a trigger. Write a test that simulates this (e.g. pass an invalid `service_id`) and asserts either full rollback or a clear cleanup.
10. **Idempotency.** User double-clicks submit. The `isSubmitting` guard (page.tsx:794) helps, but a network retry on a slow link can still fire twice. Either use an Idempotency-Key header (client-generated UUID persisted per draft) or a unique constraint on `(customer_id, preferred_professional_id, appointment_date, start_time)` while status is active. Add a test that fires two submits with the same draft and asserts exactly one row exists.
11. **Spanning midnight.** A service ending after 23:59 would roll `end_time` past `24:00:00`. `toHHMM(toMinutes("23:30") + 60)` → `"24:30"` which `TIME` column will reject. Test: service 120 min, working hours 22:00–23:59 → should produce zero valid slots, not a DB error.
12. **Working hours data errors.** A row with `start_time >= end_time` or `start_time = end_time` should be treated as "no availability" — today, `buildTimeSlots` relies on the loop condition `t + durationMin <= hours.end` so a 0-length window returns `[]`, which is safe. Still worth pinning.
13. **RLS for the RPC itself.** A customer somehow deleted/renamed → does the RPC fail gracefully when called with a stale JWT? (It shouldn't — it's SECURITY DEFINER and takes no auth input — but test it.)
14. **Unassigned appointments visible for barber deactivation.** If a barber is later removed and their `preferred_professional_id` is set to `ON DELETE SET NULL`, the RPC returns rows with `barber_id=NULL`. Verify RPC filters these out (currently relies on the ANY match, so NULL ≠ any uuid → correctly excluded). Pin with a test.
15. **Concurrency under assignment.** Admin assigns pending to `professional_id=B` at the same moment another customer is booking `preferred=B`. Both can succeed individually; the constraint uses COALESCE so the overlap is caught. But confirm this race in a test with `Promise.all`.
16. **Data retention / cleanup.** What happens to very old `pending` appointments that were never confirmed? They still block slots forever. Consider a scheduled job to auto-cancel pendings older than N hours. Add a test for the policy once defined.
17. **Accessibility/keyboard.** Modal must trap focus, time slots must be keyboard-selectable, ARIA labels on date buttons. Add axe-core assertions in E2E.
18. **Mobile viewport.** Date carousel wraps correctly, time-slot grid is scrollable, map renders. Add a Playwright project with a mobile device preset.

---

## Minimum bar before shipping a booking change

A PR that touches any of these files must keep the full suite green:

- `lib/queries/appointments.ts`
- `app/page.tsx` (booking-modal section)
- `supabase/migrations/002_create_core_tables.sql` (appointment/availability schemas)
- `supabase/migrations/003_rls_policies.sql` (appointment policies)
- `supabase/migrations/014_booked_slots_and_overlap_guard.sql` (RPC + EXCLUDE)
- `lib/booking/*` (after extraction for unit tests)

CI should run: unit (fast, always) + DB integration (needs service-role key, gated) + E2E (slowest, on PR label or nightly).

---

## Suggested execution order

1. Extract pure helpers into `lib/booking/slots.ts` and `lib/booking/date-slots.ts` (no behaviour change, just testability).
2. Land section 1–5 unit tests.
3. Land section 6–10 DB tests — these protect the fix that was just shipped.
4. Land the E2E scaffold and section 12 (time-step) first, then 11, 13–17.
5. Work through the "things you aren't paying attention to" list — most become product decisions before they become tests.
