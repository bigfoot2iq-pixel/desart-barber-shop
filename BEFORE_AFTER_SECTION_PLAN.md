# Before / After Transformations Section — Implementation Plan

**Target page:** `app/[lang]/_booking-experience.tsx`
**New component:** `app/components/before-after.tsx` (client component)
**Dictionaries:** `lib/i18n/dictionaries/{en,fr}/booking.json`
**Insertion point:** between the hero `<section>` (ends at line 201) and the existing services `<section id="services">` (starts at line 203).

**Scope:** Landing page only. Do not touch admin, booking modal, auth, or routing. No DB / backend changes. Content is static (hardcoded image URLs + i18n captions) — this is a marketing showcase, not an editable CMS block.

---

## 1. UX concept

A **drag-to-reveal image comparison slider** ("before" on the left/bottom, "after" on the right/top, split by a vertical gold divider with a circular handle).

Why this pattern (vs. two static side-by-side images or a plain carousel):
- Self-evident affordance — the handle invites interaction and tells the user "drag me."
- Keeps both states at full resolution on mobile (vs. shrinking two images into one viewport).
- Proven pattern for before/after in barber, cosmetics, dental, real-estate renovation — users already know it.
- Respects the brand's editorial restraint: no gimmicks, no 3D flips, just a clean gesture.

We ship **one large featured slider** plus a strip of **thumbnail selectors** (3–5 transformations). Desktop shows the strip as a horizontal row under the slider; mobile shows the strip as a thinner scrollable row with swipe also switching the featured slider.

**Why not a multi-slider grid?**
Each comparison slider is a heavy interactive element. Stacking 4 of them on one screen creates visual competition (which one do I drag?) and doubles image bandwidth. One hero slider + lightweight thumbnail picker keeps attention focused and LCP low.

---

## 2. Section placement & visual rhythm

Current vertical flow:
1. Black hero (`bg-brand-black`, full-bleed videos)
2. **→ NEW: Before/After section**
3. Gold services (`bg-gold-bg`)
4. Gold marquee band
5. Black team
6. Quote band
7. Gold locations
8. Black footer

The new section sits between two high-contrast blocks (black hero → gold services). To avoid a jarring double-black or washed-out triple-light sequence, use **`bg-black2` (#110e05)** as the background — it reads as a distinct "chapter" from the hero's pure `brand-black`, while keeping the dark editorial mood so the image content stays hero. The top edge gets a hairline gold-tinted border (`border-t border-[rgb(192_154_90/0.12)]`) to mark the transition without shouting.

---

## 3. Layout specifics

All measurements follow existing conventions in `_booking-experience.tsx`:
- Outer padding: `py-20 px-4 sm:py-24 lg:py-28` (slightly more generous than services' `py-12` — the slider needs breathing room).
- Content width: `max-w-[1160px] mx-auto` (matches services, team, locations).
- Section header: reuse the exact eyebrow + headline structure from the services section (`_booking-experience.tsx:205-211`) so the section feels native, not bolted-on.

### 3.1 Header

```
[hairline + eyebrow]   THE PROOF
Before · After             (playfair, clamp 40–66px, italic "After" in gold3)
Small description paragraph, opacity-60, max-w-[520px]
```

- Eyebrow uses the same `before:content-[''] before:w-[26px] before:h-px before:bg-current` line-lead used by every other section (team at line 281, locations at line 381).
- The italic accent word ("After" in EN, "Après" in FR) uses `<em className="italic text-gold3">` — same pattern as hero headline and team headline.

### 3.2 Slider (desktop ≥lg, 1024px+)

- Container: `relative w-full aspect-[16/10] rounded-[18px] overflow-hidden` (same `rounded-[18px]` as location cards at line 389).
- Max height cap: `max-h-[640px]` so it never dominates above the fold on ultrawide displays.
- Images: two `<img>` tags stacked absolutely, identical positioning, object-cover. "After" is on top with a `clipPath: inset(0 {100 - pct}% 0 0)` so dragging changes `pct`.
- Divider: 2px vertical line in `bg-gold3`, positioned at `left: {pct}%`, with a 56×56px circular handle centered on it. Handle = `bg-gold3 border-[3px] border-brand-white/95 shadow-[0_6px_18px_rgb(0_0_0/0.45)]` containing a small chevron-left + chevron-right SVG pair (same stroke weight as the hero arrow at line 162).
- "BEFORE" and "AFTER" labels: absolutely positioned in top corners, `text-[10px] tracking-[0.22em] uppercase`, backed by `bg-brand-black/55 backdrop-blur-sm px-3 py-1.5`. Matches the tag style used on VideoCell at `video-grid.tsx:145`.

### 3.3 Slider (mobile <lg)

- Container: `aspect-[4/5]` (portrait — more vertical emphasis for face/haircut shots, fits narrow viewports).
- Same divider / handle — but handle grows to 60×60px with a thicker touch target (`::before` pseudo-element expanding hit area by 12px each side for thumbs).
- Labels shrink to `text-[9px]`.
- No reduction in image quality — both images are full-res, `loading="eager"` for the active one and `loading="lazy"` for the others.

### 3.4 Thumbnail strip

**Desktop:** horizontal flex row beneath the slider, `gap-3 mt-6`. Each thumbnail is `w-[168px] aspect-[16/10] rounded-[10px]`, showing only the "after" image (with a 1px gold border when active, `border-[rgb(254_251_243/0.1)]` when inactive, hover lifts it `-translate-y-1`). A tiny styled label beneath each thumb names the transformation ("Fade & Beard", "Full Restyle", etc.) in `font-playfair text-[13px]`.

**Mobile:** same row but horizontally scrollable with `overflow-x-auto snap-x snap-mandatory -mx-4 px-4` (matching the edge-bleed used elsewhere for "off-canvas peek" affordance). Active state: thumbnail gets a gold bottom-border indicator. Thumbs are `w-[120px] aspect-[4/5]`.

### 3.5 Hint / instruction

Under the slider, a single line: `← DRAG TO REVEAL →` in `text-[10px] tracking-[0.22em] uppercase text-brand-white/40`. Fades out after first interaction (`data-interacted` state toggle + `transition-opacity duration-500`) — classic "teach once, get out of the way" pattern.

---

## 4. Interaction & gesture specification

### 4.1 Default state
- `pct` (reveal percentage) = 50% on mount.
- Thumbnail strip index = 0.

### 4.2 Pointer events (unified mouse + touch, use `onPointerDown/Move/Up`)
- On `pointerdown` on the container OR the handle: capture pointer, set dragging = true.
- On `pointermove` while dragging: compute `pct = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100)`.
- On `pointerup` / `pointercancel`: release pointer, dragging = false, set `data-interacted=true`.
- Use `element.setPointerCapture(e.pointerId)` so the gesture continues even if the cursor leaves the container.
- `touch-action: none` on the slider container to prevent vertical page scroll stealing horizontal drags.

### 4.3 Keyboard (a11y)
- Handle has `role="slider"`, `tabIndex={0}`, `aria-valuemin={0}`, `aria-valuemax={100}`, `aria-valuenow={Math.round(pct)}`, `aria-label={t("beforeAfter.sliderAria")}`.
- `ArrowLeft` / `ArrowRight`: ±2% per press. With `Shift`, ±10%. `Home` → 0, `End` → 100.
- Visible focus ring: `focus-visible:ring-2 focus-visible:ring-gold3 focus-visible:ring-offset-2 focus-visible:ring-offset-black2`.

### 4.4 Swipe between transformations (mobile)
- On the slider container, **if** `pct` is fixed (not mid-drag) and the gesture's horizontal delta exceeds 60px at the edges (`pct === 0` swiping right, or `pct === 100` swiping left), switch the active transformation. Otherwise keep the drag as a reveal gesture.
- Simpler alternative (**recommended**): do not overload gestures on the main slider. Keep transformation switching to the thumbnail strip + explicit prev/next buttons. Reduces cognitive load and avoids conflict.

### 4.5 Reduced motion
- Respect `prefers-reduced-motion: reduce`. Skip the entrance `fade-up` animation and any handle pulse. The slider itself is user-controlled, so no adjustment there.

---

## 5. Content & assets

### 5.1 Image sourcing
Five transformations, each a `{ before, after, caption, styleTag }` object. Use the same Supabase storage bucket the hero videos already live in (`ftqpkwbbrnvwpgcxiuli.supabase.co/storage/v1/object/public/desart-barber-shop/…`) for consistency and CDN reuse — **do not** introduce a new hosting location.

File naming convention to request from the owner:
- `ba-1-before.jpg`, `ba-1-after.jpg`, `ba-2-before.jpg`, … `ba-5-after.jpg`
- 1600px wide minimum, JPEG quality 85, sRGB, identical framing/crop/lighting between before & after (critical — mismatched crops ruin the effect).

**Blocker:** these images don't exist yet. Implementation agent should scaffold the component with 5 placeholder entries pointing at `HERO_POSTERS[0..4]` (reused from `app/components/video-grid.tsx:17-27`) for both before and after, so the slider is testable immediately, then swap URLs once real pairs are uploaded. Leave a `// TODO: replace with real before/after pairs` comment on the `TRANSFORMATIONS` constant.

### 5.2 Image rendering
- Use native `<img>` (not `next/image`) to match the pattern already used across `_booking-experience.tsx` (see hero images at line 342, logo at line 126). The project is mid-migration away from `next/image` per existing conventions — do not introduce it here.
- `loading="eager"` for the active transformation's two images (both before and after must be decoded before the reveal is useful). `loading="lazy"` for inactive transformations.
- `decoding="async"`, `draggable={false}` (prevents browser's default image-drag ghost interfering with the pointer gesture).

### 5.3 i18n additions

Add to `lib/i18n/dictionaries/en/booking.json`:

```json
"beforeAfter": {
  "eyebrow": "The Proof",
  "headline": "Before ·",
  "headlineEm": "After",
  "subheadline": "Real chairs. Real clients. Drag to see the difference a Desart cut makes.",
  "dragHint": "Drag to reveal",
  "beforeLabel": "Before",
  "afterLabel": "After",
  "sliderAria": "Before-and-after comparison slider. Use left and right arrow keys to reveal more of each image.",
  "transformations": [
    { "caption": "Fade & Beard Sculpt", "tag": "Precision Fade" },
    { "caption": "Full Restyle", "tag": "Complete Makeover" },
    { "caption": "Classic Cut Refresh", "tag": "Heritage Craft" },
    { "caption": "Textured Crop", "tag": "Modern Edge" },
    { "caption": "Beard Reshape", "tag": "Signature Grooming" }
  ]
}
```

Add to `lib/i18n/dictionaries/fr/booking.json` (translator-reviewed — do not machine-translate blind):

```json
"beforeAfter": {
  "eyebrow": "La Preuve",
  "headline": "Avant ·",
  "headlineEm": "Après",
  "subheadline": "Vrais fauteuils. Vrais clients. Glissez pour voir la différence d'une coupe Desart.",
  "dragHint": "Glisser pour révéler",
  "beforeLabel": "Avant",
  "afterLabel": "Après",
  "sliderAria": "Comparateur avant-après. Utilisez les flèches gauche et droite pour révéler davantage chaque image.",
  "transformations": [
    { "caption": "Dégradé & Barbe", "tag": "Dégradé Précision" },
    { "caption": "Nouvelle Identité", "tag": "Transformation Totale" },
    { "caption": "Coupe Classique", "tag": "Artisanat Traditionnel" },
    { "caption": "Coupe Texturée", "tag": "Allure Moderne" },
    { "caption": "Barbe Restructurée", "tag": "Soin Signature" }
  ]
}
```

Access pattern: follow `useT("booking")` + `tBooking("beforeAfter.eyebrow")` exactly as used throughout the existing file (e.g. line 144, 207). For the array-indexed captions use `tBooking(\`beforeAfter.transformations.${i}.caption\`)` — same dotted-index shape already used for `marquee.${i}` at line 270.

---

## 6. Component file structure

Create `app/components/before-after.tsx`:

```tsx
"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useT } from "@/lib/i18n/client-dictionary";

// TODO: replace with real before/after pairs once uploaded to the
// desart-barber-shop Supabase bucket (ba-1-before.jpg … ba-5-after.jpg).
const TRANSFORMATIONS = [
  { before: "…/ba-1-before.jpg", after: "…/ba-1-after.jpg" },
  // 4 more
];

export function BeforeAfterSection() {
  const tBooking = useT("booking");
  const [activeIdx, setActiveIdx] = useState(0);
  const [pct, setPct] = useState(50);
  const [hasInteracted, setHasInteracted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  // pointer handlers, keyboard handlers, etc.
  // see section 4 for behavior spec

  return (
    <section id="before-after" className="bg-black2 text-brand-white py-20 px-4 sm:py-24 lg:py-28 border-t border-[rgb(192_154_90/0.12)]">
      {/* header, slider, thumbnail strip */}
    </section>
  );
}
```

Export a single named component. Import and render in `app/[lang]/_booking-experience.tsx` directly after the hero `</section>` close (line 201) and before `<section id="services">` (line 203):

```tsx
import { BeforeAfterSection } from "@/app/components/before-after";

// …inside BookingExperienceInner return, between hero and services:
<BeforeAfterSection />
```

No props needed — it reads i18n via the existing `DictionaryProvider` context that wraps the page.

---

## 7. Styling conventions (match existing file)

- Tailwind v4 utilities only, no CSS modules, no styled-components. The repo uses Tailwind v4 (`tailwindcss: ^4` in `package.json`), which supports arbitrary values with the `[rgb(…)]` and `[clamp(…)]` syntax already heavily used in `_booking-experience.tsx`.
- Colors: only use theme tokens from `app/globals.css` (`gold`, `gold2`, `gold3`, `gold4`, `brand-white`, `brand-black`, `black2`, `ink`, `gold-bg`, `cream`, `off`). Do not introduce new hex values.
- Fonts: `font-playfair` for the h2, `font-fraunces` only on the hero (don't bleed it into this section), default sans for body copy and labels.
- Eyebrow text: `text-[10px] font-medium tracking-[0.22em] uppercase text-[rgb(254_251_243/0.5)]` — copy from team header at line 281.
- Use `text-gold3` (the lighter gold #d4ae70) for accents on dark backgrounds — matches the rest of the dark sections. Reserve the base `gold` / `gold-bg` for light-background sections only.
- Transitions: `transition-[transform,opacity] duration-300 ease-out` for hover states; do not animate the slider reveal itself on drag (must be 1:1 with the pointer, any lag feels broken).
- Border radius: `rounded-[18px]` for the main slider (matches location cards at line 389), `rounded-[10px]` for thumbnails.

---

## 8. Accessibility checklist

- [ ] Slider handle has `role="slider"`, `aria-valuemin/max/now`, and `aria-label`.
- [ ] Handle is keyboard-focusable and responds to arrow keys, Shift+arrows, Home, End.
- [ ] Visible focus ring on the handle.
- [ ] Each thumbnail `<button>` has `aria-label={t("beforeAfter.transformations.${i}.caption")}` and `aria-pressed={i === activeIdx}`.
- [ ] Both images in the slider have descriptive `alt` text: `"${caption} — before"` / `"${caption} — after"`. Do NOT use `alt=""` here — the images ARE the content.
- [ ] Section has `aria-labelledby` pointing at the `<h2>`.
- [ ] `prefers-reduced-motion` respected (see 4.5).
- [ ] Slider works with keyboard alone (no pointer required). Verify in Firefox + Chrome tab navigation.
- [ ] Color contrast: `text-brand-white/40` for the drag hint meets WCAG AA on `bg-black2` (ratio ~7:1) — verified. If any label drops below AA, bump opacity, don't bump color.

---

## 9. Performance budget

- Five transformation pairs = 10 images. At 1600px × JPEG 85 = ~200KB each → ~2MB total.
- Eager-load only the **active** transformation's two images (~400KB on first paint). Lazy-load the other 8.
- Preload the active pair via `<link rel="preload" as="image">` ONLY if the section lands above the fold on desktop — it does not (hero is full viewport), so skip preload.
- When the user clicks a thumbnail, the target pair should already be lazy-loaded by intersection observer; if not, show a subtle shimmer placeholder (`bg-[rgb(255_255_255/0.04)]` pulse) for ≤300ms rather than a spinner.
- **Do not** autoplay a GIF or video version of the transformation — kills performance and removes user control, which is the whole point of the pattern.

---

## 10. Responsive breakpoints (match existing conventions)

The file uses `sm:` (640px), `lg:` (1024px), and `max-sm:` extensively. Follow suit:

| Breakpoint | Layout |
|-----------|--------|
| `<sm` (<640px) | Portrait `aspect-[4/5]` slider, thumbnails horizontal-scroll with snap, stats hidden, single column |
| `sm` – `<lg` (640–1023px) | `aspect-[16/11]` slider, thumbnails fit in one row without scroll, section padding `py-24` |
| `lg+` (1024px+) | `aspect-[16/10]` slider capped at `max-h-[640px]`, thumbnail row centered under slider, generous `py-28` |

No `md:` breakpoint anywhere in the file — don't introduce one here either.

---

## 11. Testing checklist (no new unit tests required — this is visual-behavior code)

Manual QA on `pnpm dev`:

1. **Drag gesture** — grab anywhere on the slider, drag left/right, verify reveal follows pointer 1:1 with no lag or rubber-banding. Release outside the container → still releases cleanly (pointer capture working).
2. **Thumbnail switching** — click each of the 5 thumbnails, verify slider swaps both images, `pct` resets to 50%, active state reflects on thumb.
3. **Keyboard a11y** — Tab to the handle (must be reachable from the page's normal tab order), use arrows, Home, End. Tab to each thumbnail and activate with Space/Enter.
4. **Mobile touch** — on a real device or Chrome DevTools touch emulation, drag the handle. Page must not scroll vertically during the drag.
5. **i18n** — switch locale, verify all strings swap (eyebrow, headline, drag hint, labels, captions, aria-label).
6. **Reduced motion** — enable macOS "Reduce motion" / Windows "Show animations off", verify the entrance animation is skipped but the slider still works.
7. **Layout at 360px, 390px, 414px, 768px, 1024px, 1440px, 1920px** — no horizontal scroll, no overlap, all text readable.
8. **Slow 3G throttle** — section still usable; shimmer shows while off-active transformations load.
9. **Keyboard focus visible** — gold focus ring on handle and thumbs.
10. **Contrast** — DevTools accessibility audit on the section should report no contrast failures.

Playwright tests: not required for v1. If added later, `playwright.config.ts` already exists; a simple smoke test clicking each thumbnail and asserting the swap would be sufficient.

---

## 12. What this plan does NOT do (explicitly out of scope)

- **No CMS / admin UI** for editing transformations. Content is hardcoded + translated. If the owner later wants editability, add a `public.transformations` table in a follow-up (not now).
- **No per-barber filtering.** The section is generic "Desart work" — not scoped to a specific professional. Adding filtering would bloat the UX.
- **No video before/afters.** Videos belong in the hero. This section is pure still-image proof.
- **No lightbox / fullscreen modal.** Keep the interaction contained. Users who want more browse Instagram (linked in footer).
- **No analytics events in v1.** If engagement needs measuring later, wire a single `section_engaged` event on first drag or thumbnail click.
- **No `next/image` migration.** Match the existing `<img>` convention in the file; don't start a migration inside this task.

---

## 13. Implementation order (suggested)

1. Add i18n keys to `en/booking.json` and `fr/booking.json`.
2. Create `app/components/before-after.tsx` with placeholder images (reuse `HERO_POSTERS` from `video-grid.tsx`) and the full slider + thumbnail logic.
3. Wire keyboard, pointer, and a11y attributes. Verify on keyboard only.
4. Import and render inside `_booking-experience.tsx` between lines 201 and 203.
5. Run `pnpm dev`, walk through the manual QA checklist.
6. Once the owner provides real `ba-N-before.jpg` / `ba-N-after.jpg` URLs, swap the `TRANSFORMATIONS` constant and drop the TODO.

Stop and flag if: (a) the Supabase bucket needs a new folder and you don't have write access, (b) the French captions feel awkward — the translator should review before merging, or (c) the before/after image pairs arrive with mismatched crops (ruins the effect; request re-shoots rather than shipping bad pairs).
