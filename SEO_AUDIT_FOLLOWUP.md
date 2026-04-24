# SEO Implementation Audit & Follow-up Plan — DESART

**Date:** 2026-04-23
**Scope:** Validation of work described in `SEO_PLAN.md` (Phases 1-6) and the follow-up roadmap.
**Domain:** `desart.ma` / `www.desart.ma`

---

## 1. Audit Summary

The previous agent executed **Phases 1, 2, 4, 5** solidly and wired **Phase 6's scaffolding** (GA4 + GSC verification). Phase 3 (Arabic) was explicitly skipped. Main weaknesses: sitemap leaking private routes, hardcoded price in Schema.org JSON-LD, and a few placeholder artifacts that slipped through.

---

## 2. ✅ Verified Correct

| Item | Evidence |
|---|---|
| `robots.ts` | `app/robots.ts:1` — disallows `/api/`, `/auth/`, `/_next/`, sitemap URL correct |
| `sitemap.ts` | `app/sitemap.ts:1` — FR+EN entries with `alternates.languages` |
| `manifest.ts` | `app/manifest.ts:1` — theme `#C9A84C`, bg `#0A0800` |
| OG / Twitter / canonical | `app/[lang]/layout.tsx:48-77` — full metadata set |
| 301 root redirect | `proxy.ts:43` — `NextResponse.redirect(url, 301)` |
| `HairSalon` + `WebSite` JSON-LD | `app/[lang]/layout.tsx:116-160` — injected in `<head>` |
| `/a-domicile` page | Server + client split, 3 JSON-LDs (Breadcrumb, FAQ, Service) |
| `/services` page | Server + client split, per-service JSON-LD iterates real DB rows |
| Footer nav links | `_booking-experience.tsx:1294,1297` point to new pages |
| GA4 + GSC verification | Layout wires both via `NEXT_PUBLIC_*` env vars |
| OG image file | `public/og-image.jpg` exists |

---

## 3. ⚠️ Issues Found

1. **Sitemap leaks private routes** — `app/sitemap.ts:50-63` includes `/login` (priority 0.3) and `/dashboard` (0.2). `/dashboard` is auth-gated → Google sees soft-404s/redirects; `/login` has zero SEO value. **Remove both.**

2. **`robots.ts` doesn't disallow `/dashboard/`, `/admin/`, `/professional/`, `/login`** — all four exist under `app/[lang]/`. Only `/api/` and `/auth/` are blocked; internal links can expose these to crawlers and waste budget.

3. **`x-default` points to `/`, not `/fr`** — `layout.tsx:54`. Google prefers a concrete URL; `/` also triggers a 301, costing a redirect hop in discovery.

4. **Home-visit Service JSON-LD hardcodes `price: '30'` MAD** — `a-domicile/page.tsx:100`. Magic number not sourced from data; if pricing changes it silently misrepresents to Google.

5. **Friday closed is implicit, not explicit** — `layout.tsx:147-154` only lists open days. Accepted by Google but can be flagged in Search Console.

6. **FAQ JSON-LD keys hardcoded to `q1..q4` / `q1..q3`** — if a dictionary entry is removed, the output ships empty `{name:'', answer:''}` entries Google may reject.

7. **Instagram link still `href="#"`** — `_booking-experience.tsx:1321`. Plan §8 flagged it but the agent didn't patch it.

8. **`generateStaticParams` hardcodes `[{lang:'fr'},{lang:'en'}]`** in `layout.tsx:100-102` — duplicates `i18n.locales`. Silently breaks when AR is added.

9. **Base URL `https://www.desart.ma` duplicated across 5+ files** — drift risk; centralize.

---

## 4. ⛔ Still Pending (from plan, unchecked)

- **6.3 Conversion events** — no `gtag('event', …)` calls anywhere for "Booking Started/Completed", "Home Visit Selected", "Salon Visit Selected".
- **6.4 Core Web Vitals reporting** — no `useReportWebVitals` / `reportWebVitals` handler.
- **Phase 3 Arabic** — deliberately skipped, scheduled as its own sprint.
- **Section 8 placeholder data** — real services, salon address, coordinates (still `30.4278, -9.5981` = Agadir center), Instagram URL, GA4 ID, GSC token, GBP.

---

## 5. Follow-up Plan

### Phase 7 — Fix-ups on shipped work (~1 day)

- [ ] **7.1 Trim `app/sitemap.ts`** — drop `/login` and `/dashboard` entries entirely.
- [ ] **7.2 Expand `app/robots.ts` disallow list** — add `/*/dashboard`, `/*/admin`, `/*/professional`, `/*/login`.
- [ ] **7.3 Fix `x-default`** — point to `/fr` (not `/`) in `app/[lang]/layout.tsx:53`.
- [ ] **7.4 De-hardcode home-visit price** — pull travel fee from the same source the UI uses (likely `booking.json` or a config constant). If no data source yet, **drop the `offers` block entirely** rather than ship a hardcoded value.
- [ ] **7.5 Harden FAQ JSON-LD** — filter entries with empty `question` or `answer` before emitting. Applies to both `/a-domicile` and `/services`.
- [ ] **7.6 Explicit Friday closed** — add a second `OpeningHoursSpecification` entry for Friday with matching `opens`/`closes` omitted or use `"Closed"` pattern.
- [ ] **7.7 Fix or remove Instagram link** — `_booking-experience.tsx:1321`. If URL isn't known, remove the `<a>` icon until it is.
- [ ] **7.8 Replace hardcoded locale list** — change `generateStaticParams` in `app/[lang]/layout.tsx` to derive from `i18n.locales`.
- [ ] **7.9 Centralize SEO constants** — create `lib/seo/constants.ts` (`BASE_URL`, business name, phone, geo) and `lib/seo/json-ld.ts` (`buildBreadcrumbJsonLd`, `buildFaqJsonLd`, `buildServiceJsonLd`, `buildLocalBusinessJsonLd`). Refactor all call sites. Kill the duplication across `layout.tsx`, `sitemap.ts`, `a-domicile/page.tsx`, `services/page.tsx`.

### Phase 8 — Finish analytics (Phase 6 completion, ~0.5 day)

- [ ] **8.1 Typed analytics helper** — `lib/analytics/events.ts` exposing a `trackEvent(name, params)` wrapper around `window.gtag`. Types restrict `name` to the four plan events.
- [ ] **8.2 Booking flow instrumentation** — fire events at:
  - funnel entry (service/professional first selected) → `booking_started`
  - location type chosen → `home_visit_selected` / `salon_visit_selected`
  - submit success → `booking_completed`
  - submit failure → optional `booking_failed` for diagnostics
- [ ] **8.3 Web Vitals reporting** — add client component with `useReportWebVitals` (Next.js 16 App Router pattern — check `node_modules/next/dist/docs/` first), forward LCP/CLS/INP/TTFB to GA4 as events. Target: LCP < 2.5s, CLS < 0.1, INP < 200ms.

### Phase 9 — Content & authority (owner-dependent)

- [ ] **9.1 Real service data in DB** — backfill `services` rows so per-service `Service` JSON-LD stops shipping placeholders.
- [ ] **9.2 Real address + geo coords** — update `salons` table AND `layout.tsx:144-145` geo AND footer address.
- [ ] **9.3 Google Business Profile** — create, then add URL to `sameAs` array on `HairSalon` JSON-LD.
- [ ] **9.4 Aggregate rating** — once reviews exist, attach `aggregateRating` to `HairSalon` schema (eligible for rich results).
- [ ] **9.5 OG image visual review** — confirm `/public/og-image.jpg` renders logo + "Premium Barber Agadir" headline clearly at 1200×630.

### Phase 10 — Arabic (deferred Phase 3)

Keep as its own sprint. Requires: `lib/i18n/config.ts` update + `generateStaticParams` refactor (from 7.8), RTL CSS, DB i18n columns (`name_ar`, `description_ar`, etc.), Arabic dictionaries, hreflang updates, sitemap updates. Estimated ~5 days.

---

## 6. Rollout Order

1. **Phase 7** (fix-ups) — no dependencies, ship immediately.
2. **Phase 8** (analytics) — unblocks measurement of Phase 7 impact.
3. **Phase 9** (owner data) — runs in parallel with 7/8; most items are non-dev.
4. **Phase 10** (Arabic) — gated on 7.8 being done and Arabic translations being ready.
