# Security model

The app has four trust levels. Each one can do what's below it, plus a narrow extra slice. Everything is enforced by Postgres RLS + triggers — not by the Next.js app — so a leaked token or a crafted SQL call hits the same wall the UI does.

## 1. Anonymous (no session)

**Can:** read active salons, active services, active professionals. That's the whole public surface.

**Cannot:** touch anything else. No reads on `profiles` or `appointments` (returns empty or permission-denied). No writes anywhere — appointments, appointment_services, profiles, salons, services, professionals all reject INSERT/UPDATE/DELETE.

**Why it matters:** the booking modal can list barbers and services without a login, but the moment the user tries to *create* an appointment, the DB refuses until they authenticate.

## 2. Customer (logged in, default role)

Gets the anon surface, plus a single-tenant slice of their own data.

**Can:**
- Read their own `profile` and their own `appointments` (+ `appointment_services` on those)
- Insert an appointment **only** where `customer_id = auth.uid()`, `status = 'pending'`, `professional_id = NULL` (no self-assigning a barber)
- Cancel their own pending/confirmed appointment (`status → cancelled`, nothing else)

**Cannot:**
- Read any other customer's profile or appointments (cross-tenant isolation)
- Change their own `role` (no escalation to admin/professional), `email` (must go through auth.users), or `id`
- Edit another customer's profile
- Change appointment fields other than status (no editing date, price, location, professional_id, etc.)
- Change status to anything except `cancelled` (no self-confirming, no marking completed)
- Delete their own appointment (only admins can delete)
- Touch `salons`, `services`, `professionals`, `professional_services`

**Key trap the trigger guards:** a customer can't sneak `professional_id` or `status='confirmed'` past RLS at insert time — the `enforce_appointment_insert_constraints` trigger fires after RLS and rejects it with a clear error.

## 3. Professional (barbers)

Gets the anon surface, plus read + limited write on rows they're assigned to.

**Can:**
- Read appointments where `professional_id = auth.uid()` (their own schedule)
- Read the customer profile of anyone they're assigned to (via a policy scoped to `appointments.professional_id = auth.uid()`)
- Update `status` and `notes` on their assigned appointments (mark confirmed/completed)
- Update their own `professionals` row (display name, phone, image) — but **not** `id`, `salon_id`, or `is_active`
- Manage their own `professional_availability` and `availability_overrides`

**Cannot:**
- Reassign themselves to an appointment they weren't given
- Change date/time/price/customer/location on an appointment (only status/notes)
- Move themselves to a different salon or flip `is_active` on (admin-only)
- Add/remove services they offer (`professional_services`) — admin-only since migration 008
- See other professionals' appointments or customers they aren't booked with

## 4. Admin

The catalog owner. No RLS restriction applies to admins for the business tables.

**Can:** everything else — CRUD on `salons`, `services`, `professionals`, assign `professional_id` on appointments, read and update any row, delete appointments, bypass every constraint the triggers impose on customers/professionals.

**Cannot (still):** change the immutable bits on `profiles` (`id`) — even admins can't remap a profile's UUID, since `id` is the auth.users FK.

---

## Enforcement layers, top to bottom

1. **RLS policies** — who can see/modify rows at all. Cross-tenant isolation lives here (`customer_id = auth.uid()`, `professional_id = auth.uid()`, `get_current_user_role() = 'admin'`).
2. **BEFORE triggers** (`enforce_*_constraints`) — field-level rules RLS can't express: which *columns* a role may change, what state transitions are legal, that inserts start with `status='pending'`, that `role`/`email`/`id` are immutable for non-admins.
3. **CHECK constraints** (the table DDL) — shape rules: `status IN (...)`, `location_type='salon' ⇒ salon_id IS NOT NULL`, valid times on overrides.

The security tests hit each of these on purpose: RLS denials show up as code `42501`, trigger denials as the exception message (e.g. *"customers may only cancel"*, *"role can only be changed by an admin"*), CHECK violations as `23514`. If any of those flip to success, a boundary moved — and the test named after that boundary turns red.

---

## Running the tests

```
pnpm test:security
```

The unauthenticated suite runs with only `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. The customer suite additionally needs `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` to create throwaway test users via the admin API; it skips cleanly when that key is absent.
