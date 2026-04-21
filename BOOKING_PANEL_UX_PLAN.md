# Implementation Plan — Booking Panel UX Polish (pre-prod)

## 0. Context the implementer MUST read before touching anything

- **Next.js fork notice:** this repo uses a non-vanilla Next.js. `CLAUDE.md` (→ `AGENTS.md`) mandates reading `node_modules/next/dist/docs/` entries for any API you touch before writing code.
- **Booking panel lives entirely in `app/page.tsx`** — a single ~2000-line client component. There is no separate `components/booking/*` folder; everything is tailwind-in-JSX using brand tokens: `bg-[#fafaf8]`, `text-brand-black`, `border-gold`, `bg-gold`, `text-gold`, DM Sans default, `font-playfair` for headings.
- Animation everywhere uses `framer-motion` (`motion`, `AnimatePresence`). Step transitions use a shared `stepVariants` + `stepTransition` (`app/page.tsx` L834–L854).
- The booking panel already has a **top-sliding toast** (L1280–L1296). It supports `kind: "success" | "error"`, with `bg-[#c09a5a]` for success and `bg-red-600` for error, slides in from `y:-40`, auto-dismisses after 2800ms (L588–L591). **This is the alert pattern the user wants used everywhere — reuse it, do not re-skin.**
- E2E tests under `__tests__/e2e/booking-*.spec.ts` depend on specific `data-testid`s and currently rely on **auto-advance** behavior on step 3. Changing step 3 UX **will break tests** — they must be updated in the same PR. Preserved test IDs listed in §6.
- Design reference for alerts: `components/user-panel/appointments-view.tsx` (the user cancel/sign-out flow). It already routes all feedback through the same top-sliding `setToast`. The booking panel should behave identically.

## 1. Problems being fixed

| # | Problem | Where |
|---|---------|-------|
| P1 | Step 3 (Choose a Service) auto-advances 500 ms after the **first** service tap, giving no time to pick a second. | `app/page.tsx` L814–L822 |
| P2 | `saveError` on step 5 renders as a small inline red block at the bottom of the form — inconsistent with the top-sliding toast used everywhere else (and in the User Panel). | `app/page.tsx` L1805–L1807 |
| P3 | `nearbyGeoError` (step 1) and `homeGeoError` (Home Location Panel) render as inline red `<p>` / `<div>` blocks — same inconsistency. | `app/page.tsx` L1377–L1379, L1947–L1949 |
| P4 | No visible affordance on step 3 that the user *can* pick more than one service. | — |
| P5 | Minor prod-readiness polish (see §5). | various |

## 2. Files to change

```
app/page.tsx                                -- all changes land here
__tests__/e2e/booking-service-step.spec.ts  -- update flow to click new Continue button
__tests__/e2e/booking-happy-path.spec.ts    -- same
__tests__/e2e/booking-details-step.spec.ts  -- assert error via new toast testid
__tests__/e2e/booking-state-consistency.spec.ts -- same
```

No new components, no new files. Do **not** extract the booking panel into its own component in this PR — out of scope.

## 3. Unified alert pattern (do this first — everything below depends on it)

### 3.1 The single source of truth is `toast`

Already declared at `app/page.tsx` L156:

```ts
const [toast, setToast] = useState<{ kind: "success" | "error"; text: string } | null>(null);
```

Extend the shape to carry an optional test id so E2E can still target booking errors specifically:

```ts
const [toast, setToast] = useState<{
  kind: "success" | "error";
  text: string;
  testid?: string;
} | null>(null);
```

### 3.2 Toast render (L1280–L1296) — add testid passthrough

Replace the inner `<div>` with:

```tsx
<div
  data-testid={toast.testid}
  role={toast.kind === "error" ? "alert" : "status"}
  aria-live={toast.kind === "error" ? "assertive" : "polite"}
  className={`rounded-xl px-4 py-3 text-sm font-medium shadow-[0_4px_16px_rgb(0_0_0/12%)] ${
    toast.kind === "success"
      ? "bg-[#c09a5a] text-white"
      : "bg-red-600 text-white"
  }`}
>
  {toast.text}
</div>
```

### 3.3 Auto-dismiss tuning

Current auto-dismiss is 2800 ms (L588–L591). Keep 2800 ms for success; bump **error** toasts to 5000 ms so users have time to read (error text tends to be longer). Implement by keying the effect off `toast.kind`:

```ts
useEffect(() => {
  if (!toast) return;
  const ms = toast.kind === "error" ? 5000 : 2800;
  const timer = window.setTimeout(() => setToast(null), ms);
  return () => window.clearTimeout(timer);
}, [toast]);
```

### 3.4 Route all three legacy error surfaces through `setToast`, then delete the inline renders

| Legacy state | Replace with | Delete the inline render at |
|--------------|--------------|-----------------------------|
| `saveError` (step 5) | `setToast({ kind: "error", text, testid: "text:booking-error" })` in the two places it's set (L757, L768) | L1805–L1807 |
| `nearbyGeoError` (step 1) | `setToast({ kind: "error", text })` at the set-site (~L459) | L1377–L1379 |
| `homeGeoError` (home panel) | `setToast({ kind: "error", text })` at the set-site (~L488) | L1947–L1949 |

Then **remove** the three `useState<string | null>(null)` declarations (L143, L146, L153) and all remaining references. The resulting state is: **one alert surface, one style, one animation, for the whole booking panel**.

> Keep the `data-testid="text:booking-error"` only on save-error toasts (via `testid` field) — tests rely on it (`booking-state-consistency.spec.ts:300`, `booking-details-step.spec.ts:251`).

### 3.5 Why not keep inline errors too?

Because the user asked for one style. Two surfaces = two styles in practice = regressions. The toast has `role="alert"` + `aria-live="assertive"` which is actually *better* a11y than the current inline red paragraphs (which are not announced).

## 4. Step 3 — "Choose a Service" CTA

### 4.1 Remove auto-advance

Delete the entire `useEffect` at **L814–L822**. Do **not** touch the step 1, 2, or 4 auto-advance effects — those are single-select steps and auto-advance there is fine.

### 4.2 Restructure step 3 render to match step 5's layout

Currently step 3 (L1482–L1509) renders straight into the scrollable parent. Step 5 (L1679–L1838) uses a two-part layout: scrollable content on top, pinned CTA footer at the bottom. Mirror that structure for step 3 so the Continue button sits in the same visual position as the step-5 Confirm button.

Replace the step 3 block with:

```tsx
{step === 3 && (
  <div className="flex flex-col h-full">
    <div className="flex-1 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgb(10_8_0/15%)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-[rgb(10_8_0/15%)] [&::-webkit-scrollbar-thumb]:rounded-sm -mx-5 px-5">
      <div className="flex flex-col gap-2 pb-2">
        {/* ...existing service list, unchanged... */}
      </div>

      {/* helper hint — only when 0 selected, so returning users aren't nagged */}
      {effectiveSelectedServices.length === 0 && (selectedBarber?.services ?? []).length > 1 && (
        <p className="text-[11px] text-[rgb(10_8_0/45%)] text-center py-3">
          Pick one or more services, then tap Continue.
        </p>
      )}
    </div>

    <AnimatePresence>
      {effectiveSelectedServices.length > 0 && (
        <motion.div
          key="service-cta"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", damping: 26, stiffness: 260 }}
          className="shrink-0 px-5 pt-3 pb-5 bg-[#fafaf8] border-t border-[rgb(10_8_0/8%)]"
        >
          <button
            type="button"
            data-testid="btn:services-continue"
            onClick={advanceStep}
            className="w-full bg-brand-black text-white text-[11px] font-semibold tracking-[0.1em] uppercase px-6 py-3.5 rounded-[10px] flex items-center justify-between gap-3 transition-[background,transform,box-shadow] duration-200 shadow-[0_2px_8px_rgb(0_0_0/12%)] border-none hover:bg-ink hover:-translate-y-px hover:shadow-[0_6px_20px_rgb(0_0_0/18%)]"
          >
            <span>
              Continue
              <span className="opacity-60 normal-case tracking-normal ml-2 font-medium">
                {effectiveSelectedServices.length} service{effectiveSelectedServices.length > 1 ? "s" : ""}
              </span>
            </span>
            <span className="font-bold tracking-[-0.01em]">
              {effectiveSelectedServices.reduce((s, x) => s + x.price, 0)} MAD
            </span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
)}
```

Exact button **classes are the same** as the step-5 Confirm button — that's the requirement.

### 4.3 Edge case — last-service-deselect

When the user taps the one selected service off, `effectiveSelectedServices.length` goes to 0 and the CTA animates away. Nothing else to handle; the `AnimatePresence` + exit variant covers it.

### 4.4 Edge case — switching barber wipes selections

`effectiveSelectedServices` already filters by the selected barber's service list (L162–L166). So the CTA's count/price are always coherent with what will actually be booked. Do not change that logic.

## 5. Additional prod-polish UX items (do these in the same PR)

Each item is scoped tight. If the implementer disagrees on any one, push back in the PR description rather than silently skipping.

### 5.1 Disable double-tap on step 3 services during step transition
After clicking Continue, the step transition takes ~350 ms. If the user taps a service in that window, the click registers against stale step-3 handlers. Guard: `onClick={() => step === 3 && toggleService(service)}`.

### 5.2 Keyboard: Enter advances when `canContinue`
Add a single `useEffect` that listens on the modal container for `keydown` Enter. If `canContinue` and step ≤ 5 and not inside a `<textarea>`, call `advanceStep()`. Skip on step 5 if an `<input>` is focused and the form is incomplete — avoid half-filled submits. Keep focus-trap semantics intact.

### 5.3 Step 4 — "No slots" messaging (L1669)
Current copy: *"No slots available on this day — try another date."* Fine, but the user has no signal which days *are* available. When this fires, also auto-expand the calendar (`setCalendarExpanded(true)`) so the user can see the month grid with available days highlighted. One line.

### 5.4 Step 5 — phone validation before submit
Currently the button is enabled as long as `phone.trim()` is non-empty. Add a light format check (Moroccan formats are `+212 ...` or `0...`). Regex: `/^(?:\+?212|0)\s?[5-7](?:[\s-]?\d){8}$/`. If invalid on submit click, `setToast({ kind: "error", text: "Please enter a valid Moroccan phone number." })` and do NOT fire `advanceStep`. Do not block keystroke input; just block submit.

### 5.5 Step 5 — don't lose form on accidental close
If `firstName || lastName || phone` is non-empty and the user clicks the X, show a `window.confirm("Discard your booking details?")`. If they cancel the confirm, keep the modal open. Cheap insurance against rage-quit data loss.

### 5.6 Step 6 — confirmation copy is misleading
Current: *"Your appointment has been received. We'll reach out to confirm within a few hours."* The appointment goes in as `status: 'pending'` which the studio confirms. Copy is fine. **But** the "Close" button just closes — on mobile, users expect a "View my bookings" affordance. Wire the Close button's secondary action to open the UserPanel's appointments view: `onClick={() => { finishBooking(); setShowUserPanel(true); }}` — optional, implementer's call. If it complicates the state reset, skip.

### 5.7 Loading skeletons instead of blank panels
Step 1 renders an empty grid while `salons` loads; step 2 an empty list while barbers load; step 3 empty while services load. Each for ~150-400 ms on a cold cache. Add a 3-row skeleton (`animate-pulse` gray blocks at the same dimensions as the real cards) when the respective array is empty **and** the fetch is in flight. Track in-flight with a single `isLoading` bool per fetch — add it next to the existing fetches at L243, L273, L302.

### 5.8 Reduce motion
Wrap the big spring transitions in a `prefers-reduced-motion` check. `framer-motion` has `useReducedMotion()`. If true, use `{ duration: 0 }` (or very short) for step transitions and toast slide-in. A11y compliance.

### 5.9 Close modal on `Esc`
The booking modal does not currently close on Escape. Add a `keydown` listener while `isModalOpen` is true. If the home sub-panel is open, Esc should close that first, then the modal on a second press.

### 5.10 Remove dead inline-error leftovers
After §3.4, grep for `text-red-500` and `bg-red-50` inside `app/page.tsx` and make sure nothing orphaned remains.

### 5.11 Tighten the "Cash only" info block (L1797–L1803)
Ship-ready copy tweak: *"Cash only — pay at your appointment. Cancellations are free; let us know in advance."* One sentence, clearer, same visual block.

## 6. Preserved `data-testid`s (do NOT rename)

- `btn:location-<id>`, `btn:barber-<id>`, `btn:service-<id>`, `btn:date-<id>`, `btn:time-<HH:MM>`
- `btn:confirm-booking`
- `text:booking-error` — must ride on the toast when `saveError` fires (see §3.4)
- `text:distance`, `step:booking-confirmed`, `btn:open-booking`

New id to add:
- `btn:services-continue` — the new step-3 CTA

## 7. E2E test updates (same PR)

### 7.1 `booking-service-step.spec.ts`
- Test **15.1** (L80): flow currently relies on auto-advance. Rewrite to: select service1, select service2 (no back-nav needed anymore), assert both are gold-highlighted, click `btn:services-continue`, assert panel title becomes "Choose a Time".
- Test **15.2** (L132): the auto-advance assertion still works — no services picked ⇒ still on step 3 ⇒ pass. But also assert `btn:services-continue` is **not** in the DOM (or is hidden).
- Test **15.3** (L163): after toggling the service off, assert `btn:services-continue` exits.

### 7.2 `booking-happy-path.spec.ts`
Insert `await page.getByTestId('btn:services-continue').click();` after the service selection step. Remove any `waitForTimeout` that was masking the auto-advance.

### 7.3 `booking-details-step.spec.ts` & `booking-state-consistency.spec.ts`
`text:booking-error` now lives on the **toast** (`absolute top-3` inside the panel). The existing `getByTestId('text:booking-error')` calls still find it because `data-testid` is attached to the inner div (see §3.2). No change needed to the assertions — but verify locally that the toast is reachable via `getByTestId` before the 5000 ms dismiss.

### 7.4 Run the whole suite
`npm run test:e2e` (or whatever the repo uses — check `package.json`). Fix anything orange. Do not merge with red.

## 8. Manual QA checklist (implementer runs before marking done)

On mobile viewport (375×812) and desktop (1440×900):

- [ ] Step 3: tap service A → CTA slides up with "Continue · 1 service · <price> MAD"; tap service B → total updates; tap A again → total updates; tap both off → CTA slides out.
- [ ] Step 3: tapping the CTA advances to step 4 with both selections preserved in the step-5 summary later.
- [ ] Step 1: deny geolocation → red top-toast "Location access denied…"; auto-dismisses after 5 s.
- [ ] Step 1 → Home panel: deny geolocation inside "Use my location" → red top-toast.
- [ ] Step 5: simulate a 23505 slot-taken error (easiest: book a slot in another tab first, then try the same slot) → red top-toast with `data-testid=text:booking-error`.
- [ ] Step 5: submit with invalid phone (e.g. "abc") → red top-toast, no network call fired.
- [ ] Esc closes the modal. Esc with the home panel open closes the home panel first.
- [ ] `prefers-reduced-motion: reduce` set in OS → step transitions & toast slide-in are visually flat.
- [ ] Success toast from the UserPanel ("Appointment cancelled") and error toasts from the booking panel use **the same** visual treatment.

## 9. Out of scope for this PR

- Extracting the booking panel into its own component.
- Replacing `window.confirm` (§5.5) with a branded modal — `confirm` is intentional for scope.
- Redesigning step 4 time-slot grid (separate effort).
- Any backend / RLS / migration work.
