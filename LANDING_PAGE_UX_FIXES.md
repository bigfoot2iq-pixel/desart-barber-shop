# Landing Page UX/UI Pre-Prod Fixes — Implementation Plan

**Target file (unless noted):** `app/[lang]/_booking-experience.tsx`
**Dictionaries:** `lib/i18n/dictionaries/{en,fr}/booking.json`, `common.json`
**Scope:** Landing page only — do not touch admin, booking modal internals, or auth flows.

Work through the sections in order. Each task is self-contained. Stop and flag if any ambiguity surfaces (especially phone number in Task 5 and address spelling in Task 15).

---

## P0 — Blockers (must ship before prod)

### 1. Hero headline overflow on narrow viewports
**File:** `app/[lang]/_booking-experience.tsx:146`
**Problem:** `whitespace-nowrap` combined with `clamp(48px,5.5vw,76px)` forces horizontal scroll when the font clamps to its 48px floor and the French translation (longer than English) overruns the viewport.
**Fix:**
- Remove `whitespace-nowrap` from the `<h1>` classlist.
- Keep the explicit `<br />` between `headline1` and `headline2` so the two-line rhythm survives.
- Verify in both `en` and `fr` at 360px, 390px, 414px widths — headline must not cause horizontal scroll.

### 2. Mobile hero exposes no CTA and no trust info
**File:** `app/[lang]/_booking-experience.tsx:153, 171`
**Problem:** `max-sm:hidden` hides both the Reserve/View-Menu button group *and* the hours/closed/payment strip on mobile. Mobile users land on hero → scroll past videos with only the floating FAB.
**Fix:**
- Remove `max-sm:hidden` from the CTA button row (`:153`). The row already has `flex-wrap`; stack nicely at narrow widths. On xs, the two buttons should be full-width stacked (add `max-sm:w-full max-sm:justify-center` to each button, and `max-sm:flex-col max-sm:items-stretch` to the wrapper).
- Remove `max-sm:hidden` from the stats strip (`:171`). Keep the existing `max-sm:gap-5 max-sm:mt-10`.
- Ensure the hero still fits within `min-h-svh` on a 360×640 viewport without requiring scroll past the fold for the primary CTA.

### 3. Untranslated English strings bypass the dictionary
**Files:**
- `app/[lang]/_booking-experience.tsx:210, 285, 370, 371, 386, 398–401, 411, 412, 415, 420, 426, 432, 439, 461–463`
- `lib/i18n/dictionaries/en/booking.json`
- `lib/i18n/dictionaries/fr/booking.json`

**Fix (dictionary additions — add to both `en` and `fr`):**

```jsonc
// booking.json
"services": {
  ...,
  "sublineCash": "Cash only. Same-day booking available."
},
"team": {
  ...,
  "subline": "Every one of our barbers brings a distinct edge. Pick your style, pick your pro."
},
"closing": {
  "quote1": "Your chair is waiting. Your best look is one appointment",
  "quote2": "away.",
  "cite": "Desart — Agadir, Since 2019"
},
"locations": {
  ...,
  "subline": "Visit us at the salon or let us come to you — your call.",
  "addressLine1": "14 Rue Mohammed V, Medína",
  "addressLine2": "Agadir 40000, Morocco",
  "hoursSatThuLabel": "Saturday – Thursday",
  "hoursFridayLabel": "Friday",
  "bookLocationCta": "Book This Location",
  "homeVisitFee": "+30 MAD Travel Fee",
  "homeVisitBody": "We travel anywhere within Agadir city limits. Just provide your address at booking.",
  "homeVisitHoursBody": "Sat–Thu · 9:00 – 17:00. Same barbers, same quality, at your door."
},
"footer": {
  ...,
  "tagline": "Premium barbershop experience in the heart of Agadir. Walk-ins welcome, appointments preferred. Cash only — always."
}
```

Provide idiomatic French translations for every new key. The French translator should preserve the tone (direct, premium, no marketing fluff).

**Fix (markup replacements):**
- `:210` → `{tBooking('services.sublineCash')}`
- `:285` → `{tBooking('team.subline')}`
- `:370–371` → compose from `closing.quote1` + `<em class="not-italic text-gold3">{tBooking('closing.quote2')}</em>`
- `:371 cite` → `{tBooking('closing.cite')}`
- `:386` → `{tBooking('locations.subline')}`
- `:398–401` → address lines use `addressLine1` / `addressLine2`
- `:411, :412, :415` → use `hoursSatThuLabel` / `hoursFridayLabel` (and existing `closedOnFriday`)
- `:420` → `{tBooking('locations.bookLocationCta')}`
- `:426` → `{tBooking('locations.homeVisitFee')}`
- `:432` → `{tBooking('locations.homeVisitBody')}`
- `:439` → `{tBooking('locations.homeVisitHoursBody')}`
- `:461–463` → `{tBooking('footer.tagline')}`

After wiring, grep the file for unescaped English (e.g., `Cash`, `Book`, `Saturday`, `Agadir`) to catch anything missed.

### 4. Dead `slideIndex` re-render loop
**File:** `app/[lang]/_booking-experience.tsx:35, 104–110`
**Problem:** `slideIndex` state advances every 5s via `setTimeout` but is never read or passed to `DesktopVideoGrid` / `MobileVideoCarousel`. Causes a re-render of the whole experience every 5s for nothing.
**Fix:** Delete the `slideIndex` state and the `useEffect` on `:104–110`. Remove the `REEL_DURATION_MS` constant if unused elsewhere (grep first).

### 5. Phone number consistency + correctness
**File:** `app/[lang]/_booking-experience.tsx:407, 496`
**Problem:** Displayed `+212 6 1221-3324` has an unusual grouping; `tel:` href is `+212612213324`. Verify the number is correct, then normalize formatting.
**Fix:**
- Confirm the real number with the owner. Moroccan mobile numbers are typically grouped `+212 6XX-XX-XX-XX`.
- Store the canonical number in a constant (or dictionary: `footer.phone`, `footer.phoneHref`).
- Use that constant in both the display (`:407`, `:496`) and the `tel:` href.
- **Do not ship until the number is verified.**

---

## P1 — High-value UX gaps (strongly recommended for launch)

### 6. Add social proof band
**Location:** New section between the gold marquee (`:262`) and the team section (`:277`), OR just below the hero.
**Scope:**
- Pull 3 short testimonials (real, from the owner — do not fabricate).
- Layout: 3-column grid desktop, stacked mobile. Each card shows a 1–2 sentence quote, first name + last initial, and either a 5-star row or Google-review badge.
- Add dictionary keys under `booking.reviews.items[]` with `{ quote, name }`.
- If the owner cannot supply testimonials in time, **skip this task and surface to the user** — do not invent them.

### 7. Add at least one salon interior photo
**Location:** Inside the "Desart Salon" card at `:389–422`.
**Scope:**
- Add a 16:9 salon interior image as the first child of the card, `rounded-[14px] object-cover`, with `loading="lazy"`.
- Source: `public/` directory (ask user for the image path if one does not exist yet — do not proceed without a real image).
- Use `next/image` (see Task 11).

### 8. Loading skeletons for services & team
**File:** `app/[lang]/_booking-experience.tsx:213, 335`
**Problem:** Desktop services grid (`:213`) and desktop team grid (`:335`) render empty while `isLoadingServices` / `isLoadingBarbers` are true. Page looks broken on slow networks.
**Fix:**
- When `isLoadingServices` is true, render 4 skeleton tiles (`bg-[rgb(10_8_0/7%)]`, `animate-pulse`, same padding and height as real cards).
- When `isLoadingBarbers` is true, render 3 skeleton cards matching the team card dimensions (300px image area + padding).
- Mobile accordions already have a loading fallback for team; add the same for services (reuse the pattern at `:291`).

### 9. Remove dead menu button / fix FAB a11y
**File:** `app/[lang]/_booking-experience.tsx:131–135, 520–532`
**Fix:**
- Delete the permanently-hidden hamburger `<button>` at `:131–135` (it has `hidden` and never unhides).
- Keep the FAB as-is; its visible text `{tCommon('bookNow')}` already serves as the accessible name. No further change needed.

### 10. Marquee pause on touch + reduced motion
**File:** `app/[lang]/_booking-experience.tsx:262–275`
**Fix:**
- Add `focus-within:[animation-play-state:paused]` alongside the existing hover rule so keyboard users can pause.
- Wrap the marquee container with `motion-reduce:animate-none` (Tailwind built-in) so users with `prefers-reduced-motion` see a static strip.

---

## P2 — Polish (post-launch iteration ok, but cheap to do now)

### 11. Swap `<img>` for `next/image`
**Files:** `app/[lang]/_booking-experience.tsx:126, 342`
**Fix:**
- Logo at `:126` → `next/image` with `width={36} height={36} priority` (above the fold).
- Barber portraits at `:342` → `next/image` with `fill` and `sizes="(min-width: 1024px) 33vw, 100vw"`.
- If Supabase storage host isn't already in `next.config.ts` `images.remotePatterns`, add it. Check first before editing.

### 12. Hero video performance audit
**Scope:** Not a code change — run a Lighthouse mobile test (throttled 4G) against the `fr` landing. If LCP > 2.5s, reduce desktop grid to 6 videos or switch the off-screen tiles to poster-only (`preload="none"`, play on intersection). Report LCP before/after to the user.

### 13. CTA copy consistency
**Files:** `app/[lang]/_booking-experience.tsx:161, 420, 449, 486, 530`
**Fix:**
- Pick one verb per surface. Recommend "Book" everywhere:
  - Hero primary: "Book a chair" (replace `hero.reserveCta` value)
  - Locations salon CTA: `locations.bookLocationCta` → "Book this location"
  - Locations home-visit CTA: `locations.homeVisitCta` → "Book a home visit"
  - FAB / footer: `common.bookNow` → "Book now"
- Update both `en` and `fr` dictionaries. Do not change the key names.

### 14. Rewrite the "testimonial-shaped" closing block
**File:** `app/[lang]/_booking-experience.tsx:366–375`
**Problem:** Reads like a quote without an author; the `cite` below makes the brand look like it's quoting itself.
**Fix (pick one):**
- (a) Turn it into a real testimonial if Task 6 produces one — use the longest quote here.
- (b) Recast as a closing CTA block: keep the large italic line, remove the `<cite>`, replace with a visible "Book now" button. Use `closing.quote1/quote2` keys from Task 3.
- Prefer (b) if Task 6 is deferred.

### 15. Address spelling verification
**File:** `app/[lang]/_booking-experience.tsx:398`
**Fix:** Confirm `Medína` vs `Medina` / `Médina` with the owner before freezing the dictionary entry in Task 3.

### 16. Redundant "Friday closed" messaging
**Files:** `app/[lang]/_booking-experience.tsx:176–179, 410–417, 499`
**Fix:** Remove the Friday entry from the hero stats strip (`:176–179`). Hours table in Locations + footer is enough.

### 17. Team card portrait crops
**Manual check:** Render desktop team grid with real data and verify each of the 3 portraits isn't awkwardly cropped at `h-[300px]` with `object-cover`. If consistently bad, raise to `h-[340px]` or add `object-[center_20%]`. Coordinate with the user before changing.

---

## Verification checklist (run before PR)

- [ ] `pnpm typecheck` clean
- [ ] `pnpm lint` clean
- [ ] Landing renders on `/fr` and `/en` with no untranslated English strings (grep the rendered HTML)
- [ ] 360px viewport: no horizontal scroll, primary CTA visible above fold, hours visible
- [ ] Lighthouse mobile: LCP < 2.5s, CLS < 0.1, no a11y violations
- [ ] Keyboard tab order reaches the primary Reserve CTA before the FAB
- [ ] `prefers-reduced-motion`: marquee static, no FAB scale animation on mount
- [ ] Dev-tools Network throttled to Slow 3G: service + team skeletons render instead of empty grids
- [ ] Phone number matches on display and `tel:` href, and is correct per owner
- [ ] Playwright landing tests (if any under `__tests__/`) still pass

---

## Out of scope (do not touch)

- Booking modal internals (`app/[lang]/_booking/*`)
- Admin surfaces
- Auth/login
- `video-grid.tsx` internals (only remove the unused `slideIndex` wiring on the landing side)
- Other pages: `/services`, `/a-domicile`, `/professional`, `/dashboard`

## Questions that must be answered before starting

1. Real phone number (Task 5).
2. Salon address canonical spelling (Task 15).
3. Are there real testimonials available? (Task 6)
4. Is there a salon interior photo in `public/` or should one be requested? (Task 7)

Do not invent content for any of the above.
