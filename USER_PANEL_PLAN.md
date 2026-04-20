# Implementation Plan — User Panel on Booking Modal

## 0. Context the implementer must know before touching code

- Booking modal lives in `app/page.tsx` (a single ~1930-line client component). Header is at **L1279–L1318**, close X at **L1313**. Everything is tailwind-in-JSX using these brand tokens: `bg-[#fafaf8]`, `text-brand-black`, `border-gold`, `bg-gold`, font-DM-Sans with `font-playfair` for titles.
- Animation uses `framer-motion`. The existing **Home Location Panel** (L1816–L1921) is the exact pattern the new panel must copy: a bottom-sheet that slides up *inside* the booking modal's content area, with a dim backdrop. **Reuse that structure, do not roll a new one.**
- Auth is already wired in `lib/auth-context.tsx`:
  - `useAuth()` exposes `user`, `signInWithGoogleModal()`, `signOut()`, `verifyUser()`.
  - `signInWithGoogleModal` opens a popup and resolves with the authenticated `User` — use this verbatim for the "Continue with Google" button. Do **not** introduce a new Google GSI iframe; the design reference is visual only.
- Appointment data model (`lib/types/database.ts`): `AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed'`. The `getCustomerAppointments(customerId)` query already returns `AppointmentWithDetails[]` joined with professional/salon/services.
- RLS already supports customer cancel via `updateAppointmentStatus(id, 'cancelled')` (see migration `009_fix_customer_cancel_policy.sql`). **No migration needed for cancel.**
- No `reviews`/`ratings` table exists — the "rate" feature requires a new migration. See §5.
- Before writing *any* code, read `node_modules/next/dist/docs/` entries — `CLAUDE.md` mandates this for this fork of Next.

## 1. Files to create

```
components/user-panel/
  user-panel.tsx            -- the bottom-sheet (signed-out + signed-in states)
  sign-in-view.tsx          -- the "Sign in" view (Google only)
  appointments-view.tsx     -- signed-in view: list + actions
  appointment-card.tsx      -- one row with status + action button
  rate-dialog.tsx           -- star-rating submit dialog
  menu-avatar-button.tsx    -- the split menu/avatar button for the header
lib/queries/reviews.ts      -- createReview, getReviewForAppointment
supabase/migrations/011_appointment_reviews.sql
```

No new file under `app/components/` — that folder is reserved for route-scoped pieces. Put reusable chunks in the top-level `components/`, matching `components/map-view.tsx` / `components/location-picker.tsx`.

## 2. Booking-modal header changes (`app/page.tsx` L1279–L1318)

1. Add state in `Home()`:
   ```ts
   const [showUserPanel, setShowUserPanel] = useState(false);
   const [toast, setToast] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
   ```
2. **Left of the X button**, insert the menu/avatar split button (new `<MenuAvatarButton />`). Visually two halves inside one pill:
   - Left half: existing hamburger (3-line) glyph, always shown.
   - Right half: if `user` → small 20×20 circular avatar using `user.user_metadata.avatar_url` (fallback: initials on a gold gradient circle); if no user → a generic person-silhouette glyph matching `#signInAvatarDefault` from the mock.
   - Sizes/colors to match the existing close button so the two look paired (`w-auto h-8 px-1.5 rounded-full border border-[rgb(10_8_0/20%)] bg-white flex items-center gap-1.5`). Use `aria-label="Open menu"`.
3. `onClick` → `setShowUserPanel(true)`.
4. Make sure the back-arrow animation (L1280–L1298) still aligns; the header is flex, so inserting one node before the X is safe.

## 3. The User Panel bottom-sheet

Mount inside the same container as the Home Location Panel (L1816), as a **sibling** AnimatePresence block, so it inherits the `absolute inset-0` scope and slides up inside the booking card only (not the whole viewport).

**Container styling** (mirrors L1831 but 75% height instead of 3/4 — same value, spell it `h-3/4`):
```
absolute inset-x-0 bottom-0 h-3/4 bg-[#fafaf8]
rounded-t-[20px] z-10 flex flex-col overflow-hidden
shadow-[0_-12px_40px_rgb(0_0_0/18%)]
```
Backdrop: duplicate the L1818 pattern with its own `onClick={() => setShowUserPanel(false)}`.

Header row inside the panel: a circular close ✕ on the right that closes the panel only (not the booking modal). Match the booking modal's close button styling. No language selector.

Body: branches on `useAuth().user`:

### 3a. Signed-out — `<SignInView />`
- Large centered icon (72px gold gradient circle with a generic user glyph — use an inline SVG).
- `Title1`-style heading "Sign in" (`font-playfair text-[28px] font-medium text-brand-black`, matching the L1783 success title).
- Subtitle "Use your Google account to manage your bookings" (muted `text-[rgb(10_8_0/50%)]`).
- **One** button: "Continue with Google" — full-width, white background, 1.5px border, the colorful Google "G" SVG on the left. On click:
  ```ts
  try { await signInWithGoogleModal(); setToast({ kind:'success', text:'Signed in successfully' }); }
  catch (e) { setToast({ kind:'error', text: e.message }); }
  ```
  The `AuthProvider` will push `user` into context; the view re-renders into 3b automatically.
- Do **not** include Apple, email, or the "Create account" link from the reference HTML. Keep only the cookie-notice line at the bottom as a muted caption.

### 3b. Signed-in — `<AppointmentsView />`
Load on mount:
```ts
useEffect(() => {
  if (!user) return;
  let cancelled = false;
  getCustomerAppointments(user.id).then(list => { if (!cancelled) setItems(list); });
  return () => { cancelled = true; };
}, [user]);
```
Layout:
- **Top identity row**: avatar (32px) + display name (from `user.user_metadata.full_name` or profile) + email caption.
- **Tabs** (optional but matches the UI feel): `Upcoming | Past` — client-side filter by status (`pending|confirmed` vs `completed|cancelled`).
- **Appointment cards** — one per appointment, styled like the barber cards at L1405 (`rounded-2xl border-[1.5px] bg-white px-[18px] py-4`). Show:
  - Service names (`services.map(s => s.name).join(', ')`)
  - Professional name + salon (or "Home visit")
  - Date (`appointment_date`) · time (`start_time`)
  - Status chip — pending: amber, confirmed: gold, completed: green, cancelled: muted gray. Use small rounded pills.
  - Right-side action:
    - `status === 'pending'` → **Cancel** button (outline red). Calls `updateAppointmentStatus(id, 'cancelled')`, optimistic update, toast on result.
    - `status === 'completed'` → **Rate** button (filled gold). Opens `<RateDialog />`.
    - `status === 'confirmed' | 'cancelled'` → no action.
- **Sticky footer** with a **Sign out** button (outline, full-width, red text). Calls `signOut()`, then `setShowUserPanel(false)` and shows success toast.

Empty state: centered "No appointments yet" + tiny CTA button that just closes the user panel (so the user is back on the booking flow).

### 3c. `<RateDialog />`
A tiny modal (nested AnimatePresence within user panel). 5-star row (tap to set), optional comment textarea, submit button. On submit → `createReview({ appointment_id, rating, comment })`, close dialog, toast "Thanks for rating!", update local item to hide the Rate button (store `review` alongside).

## 4. Toast (success message on top of the booking panel)

Render inside the booking modal root, **above** everything (`absolute top-3 left-3 right-3 z-20`). Use framer-motion `initial={{y:-40,opacity:0}}`, `exit={{y:-40,opacity:0}}`, auto-dismiss after 2.8s via `setTimeout` in a `useEffect` keyed on toast identity.

Success variant: gold/green tint. Error variant: red tint. Text from `toast.text`.

## 5. Reviews migration — `011_appointment_reviews.sql`

```sql
create table public.appointment_reviews (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  professional_id uuid references public.professionals(id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

alter table public.appointment_reviews enable row level security;

-- Customer can read their own, insert only for their own completed appointment.
create policy "reviews: customer read own"
  on public.appointment_reviews for select
  using (customer_id = auth.uid());

create policy "reviews: customer insert own for completed"
  on public.appointment_reviews for insert
  with check (
    customer_id = auth.uid()
    and exists (
      select 1 from public.appointments a
      where a.id = appointment_id
        and a.customer_id = auth.uid()
        and a.status = 'completed'
    )
  );

-- Admin + the reviewed professional can read.
create policy "reviews: admin read all" on public.appointment_reviews for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "reviews: professional read own" on public.appointment_reviews for select
  using (professional_id = auth.uid());
```

Add `Review` / `AppointmentReview` to `lib/types/database.ts` and two queries in `lib/queries/reviews.ts`:
- `createReview({ appointment_id, customer_id, professional_id, rating, comment })`
- `getReviewsForAppointments(ids: string[])` (bulk fetch so the list view can mark which completed bookings already have a review).

## 6. Query additions in `lib/queries/appointments.ts`

- `cancelAppointment(id: string)` → thin wrapper around `updateAppointmentStatus(id, 'cancelled')` just for clarity at call-sites; optional.
- No other backend changes.

## 7. Acceptance checklist for the implementer

1. Menu button appears immediately left of the X in the booking header, at all 6 steps including step 6.
2. When signed out, menu button shows hamburger + generic silhouette; when signed in, shows hamburger + user's Google avatar (with initials fallback).
3. Clicking menu opens a bottom-sheet inside the booking modal (not full-screen), 75% height, sliding up with spring animation matching the Home Panel.
4. Sheet backdrop dims the booking modal content and closes the sheet on click.
5. Signed-out sheet offers **only** Google sign-in (no Apple, no email, no "create account").
6. After Google auth completes, the sheet seamlessly switches to the appointments view and a success toast slides down from the top of the booking modal for ~3s.
7. Pending appointments have a working **Cancel** button that updates status optimistically and refreshes on success; Supabase rejection reverts the optimistic change with an error toast.
8. Completed appointments have a working **Rate** button opening a 1–5 star dialog that writes to `appointment_reviews`; re-opening the sheet later shows no Rate button for already-rated ones.
9. **Sign out** button at the bottom signs the user out, collapses the sheet, and the menu button reverts to the generic silhouette.
10. ESC closes the user panel (not the booking modal) when the panel is open; the existing ESC-closes-modal handler at L600–L607 must be adjusted to respect this precedence.
11. Mobile (`max-sm`): full-width; no horizontal gaps. Match the `max-sm:w-full max-sm:h-full` pattern the booking modal uses.
12. No regressions in the existing booking flow — step 5 "Continue with Google" still works (it shares the same `signInWithGoogleModal`).

## 8. Out of scope

- Real-time push of appointment status changes — the current page reloads the list each time the sheet opens.
- Rating display on the public site / barber cards.
