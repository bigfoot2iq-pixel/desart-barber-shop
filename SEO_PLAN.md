# SEO Plan — DESART Barber Shop

**Domain:** `desart.ma` / `www.desart.ma`  
**Target Markets:** Agadir, Morocco  
**Languages:** French (FR), English (EN), Arabic (AR), Moroccan Darija (Darija)  
**Last Updated:** 2026-04-22 (Phases 1-6 complete)

---

## 1. Executive Summary

Current SEO state is minimal. The site has basic per-locale `<title>` and `<description>` plus `hreflang` alternates, but is missing:
- `sitemap.xml`, `robots.txt`
- Open Graph / Twitter Card tags
- Structured data (Schema.org JSON-LD)
- Canonical URLs
- Arabic language support (critical for Agadir search volume)
- Keyword-targeted landing pages beyond a single scrollable homepage

This plan is split into 6 phases. Each phase ends with a deployable increment.

---

## 2. Keyword Strategy

| Market | FR Keywords | EN Keywords | AR (MSA) Keywords | Darija Keywords |
|--------|-------------|-------------|-------------------|-----------------|
| **Salon** | salon de coiffure agadir, coiffeur agadir, barbier agadir, coupe homme agadir, meilleur barbier agadir | barber agadir, barbershop agadir, haircut agadir, men's haircut agadir, best barber agadir | صالون حلاقة أكادير، حلاق أكادير، حلاقة رجالية أكادير، قص شعر رجالي أكادير، أفضل حلاق في أكادير | حلاق فاكادير، باربير فاكادير، صالون حلاقة فاكادير، قصان فاكادير، أحسن حلاق فاكادير |
| **Home Visit** | coiffeur à domicile agadir, coupe à domicile agadir, barbier à domicile agadir | home haircut agadir, barber at home agadir, mobile barber agadir, house call haircut agadir | حلاق متنقل أكادير، حلاقة في المنزل أكادير، حلاق في البيت أكادير، قص شعر في المنزل أكادير | حلاق كيجي للدار فاكادير، حلاقة فالدار فاكادير، باربير كيجي حتى لدار، قصان فالدار |
| **Services** | dégradé agadir, rasage à l'ancienne agadir, sculptage barbe agadir, taille de barbe agadir | fade haircut agadir, hot towel shave agadir, beard trim agadir, classic cut agadir | تدريج الشعر أكادير، حلاقة بالشفرة أكادير، تهذيب اللحية أكادير، حلاقة كلاسيكية أكادير | دݣرادي فاكادير، حلاقة بالشفرة فاكادير، تحفيف اللحية فاكادير، كوبا كلاسيك فاكادير |

---

## 3. Phases & Tracking

### Phase 1 — Technical SEO Foundation
*Goal: Ensure crawlers can discover, index, and understand every page.*

- [x] **1.1 `robots.txt`**
  Created `app/robots.ts`. Allows all user-agents, disallows `/api/`, `/auth/`, `/_next/`, points to `https://www.desart.ma/sitemap.xml`.

- [x] **1.2 `sitemap.xml`**
  Created `app/sitemap.ts`. Generates entries for `/fr`, `/en` with priority and changeFrequency. Updated when Arabic is added.

- [x] **1.3 Open Graph & Twitter Cards**
  Updated `generateMetadata` in `app/[lang]/layout.tsx` with `og:title`, `og:description`, `og:type`, `og:url`, `og:site_name`, `og:locale`, `og:image`, `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`. **Note:** OG image (`/og-image.jpg`, 1200×630) needs to be created and placed in `/public/`.

- [x] **1.4 Canonical URLs**
  Added `alternates.canonical` in metadata pointing to `https://www.desart.ma/{lang}`.

- [x] **1.5 `manifest.json`**
  Created `app/manifest.ts` with PWA basics (theme color `#C9A84C`, background `#0A0800`, icons from `/logo.jpg`).

- [x] **1.6 Image optimization**
  Audited all `<img>` tags — all have descriptive `alt` text. Videos are decorative (`aria-hidden="true"`) with proper accessibility attributes.

- [x] **1.7 301 redirect root `/` → `/{defaultLocale}`**
  Updated `proxy.ts` to use `NextResponse.redirect(redirectUrl, 301)` for locale redirect. Confirmed working.

---

### Phase 2 — New Keyword-Targeted Landing Pages
*Goal: Create dedicated URLs so each keyword cluster has a unique, indexable page.*

- [x] **2.1 `/[lang]/a-domicile` — Home Visit Landing Page**
  Created `app/[lang]/a-domicile/page.tsx` (server) + `_home-visit-content.tsx` (client). Includes hero with keyword-rich H1/H2, 3-step "How It Works", service cards, professionals list, FAQ, and CTA. JSON-LD: BreadcrumbList + Service schema.

- [x] **2.2 `/[lang]/services` — Services Landing Page**
  Created `app/[lang]/services/page.tsx` (server) + `_services-content.tsx` (client). Lists all active services with prices/durations, FAQ, and CTA. JSON-LD: BreadcrumbList + per-service Service schema.

- [x] **2.3 Update internal navigation**
  Added "Services" and "Home Visit" links to the footer navigation in `_booking-experience.tsx`.

- [x] **2.4 Breadcrumb structured data**
  Added `BreadcrumbList` JSON-LD to both `/a-domicile` and `/services` pages.

---

### Phase 3 — Arabic (AR) Language Support
*Goal: Capture the majority of local search volume in Agadir.*
**STATUS: SKIPPED — Will be a separate sprint later.**

- [ ] ~~**3.1 Add `ar` to i18n config**~~
- [ ] ~~**3.2 RTL layout support**~~
- [ ] ~~**3.3 Arabic dictionaries**~~
- [ ] ~~**3.4 Database i18n columns for Arabic**~~
- [ ] ~~**3.5 Admin UI Arabic fields**~~
- [ ] ~~**3.6 Update metadata & sitemap for AR**~~
- [ ] ~~**3.7 Arabic OG locale tag**~~

---

### Phase 4 — Structured Data (Schema.org)
*Goal: Enable rich snippets in Google SERPs.*

- [x] **4.1 `LocalBusiness` / `HairSalon` schema on homepage**
  Added to root layout (`app/[lang]/layout.tsx`). Type: `HairSalon`, phone: `+212612213324`, hours: Mo-Th+Sat-Sun 09:00-17:00, Fr closed, area: Agadir.

- [x] **4.2 `Service` schema on services page**
  Added per-service JSON-LD on `/[lang]/services`. Includes name, description, price in MAD, provider.

- [x] **4.3 `WebSite` schema**
  Added to root layout with `SearchAction` potential action.

- [x] **4.4 `FAQPage` schema**
  Added to `/[lang]/a-domicile` (4 questions) and `/[lang]/services` (3 questions).

- [x] **4.5 `BreadcrumbList` schema**
  Added to `/[lang]/a-domicile` and `/[lang]/services`.

---

### Phase 5 — On-Page Content Optimization
*Goal: Ensure every page has clear keyword focus and semantic HTML.*

- [x] **5.1 Rewrite meta titles & descriptions**
  Homepage:
  - FR: `DESART — Salon de Coiffure & Barbier Premium à Agadir | Réserver`
  - EN: `DESART — Premium Barbershop & Haircut in Agadir | Book Now`

  `/a-domicile` and `/services` have dedicated meta titles via `generateMetadata`.

- [x] **5.2 Heading hierarchy audit**
  All new pages have single H1, logical H2/H3 flow. Homepage unchanged (existing structure).

- [x] **5.3 Keyword-rich intro paragraphs**
  Both `/a-domicile` and `/services` have keyword-rich hero sections with H1, subtitle, and description.

- [x] **5.4 Internal linking**
  Footer in `_booking-experience.tsx` updated with links to `/services` and `/a-domicile`. New pages link back to homepage booking.

- [x] **5.5 Footer NAP consistency**
  Phone updated to `+2126 1221-3324`. Address placeholder in footer (14 Rue Mohammed V, Agadir).

---

### Phase 6 — Analytics & Search Console
*Goal: Measure traffic, rankings, and conversions.*

- [x] **6.1 Google Search Console verification**
  Added `verification.google` to metadata using `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` env var.

- [x] **6.2 Google Analytics 4 (GA4)**
  Added `gtag.js` via `next/script` with `afterInteractive` strategy. Uses `NEXT_PUBLIC_GA_MEASUREMENT_ID` env var.

- [ ] **6.3 Conversion events**
  Track: "Booking Started", "Booking Completed", "Home Visit Selected", "Salon Visit Selected".

- [ ] **6.4 Core Web Vitals monitoring**
  Use Next.js built-in web vitals reporting. Target LCP < 2.5s, CLS < 0.1, INP < 200ms.

---

## 4. Sitemap Outline (Post-Implementation)

```
https://www.desart.ma/fr/           (homepage — salon focus)
https://www.desart.ma/fr/a-domicile  (home visit)
https://www.desart.ma/fr/services    (services list)
https://www.desart.ma/en/           (homepage)
https://www.desart.ma/en/a-domicile
https://www.desart.ma/en/services
```

---

## 5. Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Arabic translations require native review | Use simple Modern Standard Arabic first; owner reviews before launch |
| Single-page app state (booking wizard) may break when rendered on sub-pages | Pre-select location/service via URL query params or props |
| OG image creation needs design time | Reuse existing logo/brand colors; generate programmatically if needed |
| Adding DB columns for `ar` duplicates existing `_fr` pattern | Follow identical migration + query layer pattern |
| `next/script` + GA4 in App Router needs careful placement | Follow Next.js 16 docs for third-party scripts |

---

## 6. Rollout Order

1. **Phase 1** (robots, sitemap, OG, canonical, manifest) — fastest win, do first.
2. **Phase 2** (new landing pages) — enables multi-keyword indexing.
3. **Phase 3** (Arabic) — largest effort; can run parallel to Phase 4 if resourced.
4. **Phase 4** (structured data) — depends on Phase 2 pages existing.
5. **Phase 5** (content optimization) — ongoing, update meta after Phase 2/3.
6. **Phase 6** (analytics) — measure impact of Phases 1-5.

---

## 7. Open Questions — Resolved (2026-04-22)

1. **Arabic — include in this sprint or fast-follow?** → **Skipped for now.** Will be a separate sprint later.
2. **Exact salon address & phone number?** → Phone: `+2126 1221-3324`. Address: **placeholder** (will update later).
3. **Google Business Profile?** → **Not yet created.** N/A for now.
4. **Services offered?** → **Using mocked services.** Will update with real data later.
5. **Analytics preference?** → **Google Analytics 4 (GA4).**

---

## 8. Placeholder Data — Owner Action Required

> **Everything below needs to be updated with real data before going live.**

### Services (Database)
- [ ] Update `services` table with real service names, descriptions, prices (MAD), and durations
- [ ] Update `name_fr` / `description_fr` columns for French translations
- [ ] Ensure all services have `is_active: true`

### Salon / Location (Database + Code)
- [ ] Update `salons` table with real salon name, address, coordinates (latitude/longitude)
- [ ] Update `name_fr` / `address_fr` columns
- [ ] Update geo coordinates in `app/[lang]/layout.tsx` (currently `30.4278, -9.5981` — placeholder Agadir center)
- [ ] Update address in footer dictionaries (`lib/i18n/dictionaries/fr/booking.json` and `en/booking.json` → `footer.address`)

### Professionals (Database)
- [ ] Ensure professionals have `profile_image_url`, `years_of_experience`, `profession` filled
- [ ] Set `offers_home_visit: true` for professionals who do home visits

### Phone Number
- [x] Updated to `+2126 1221-3324` in footer
- [ ] Verify phone in `booking.json` → `footer.address` and payment instructions if referenced elsewhere
- [ ] Update WhatsApp number in notification settings if different

### OG Image
- [ ] Save generated OG image to `public/og-image.jpg` (1200×630)

### Analytics & Search Console
- [ ] Create GA4 property → get Measurement ID (format: `G-XXXXXXXXXX`)
- [ ] Add to `.env.local`: `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX`
- [ ] Verify site in Google Search Console → get verification code
- [ ] Add to `.env.local`: `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=your-code`
- [ ] Submit sitemap `https://www.desart.ma/sitemap.xml` in Search Console

### Google Business Profile
- [ ] Create Google Business Profile for DESART
- [ ] Ensure NAP (Name, Address, Phone) matches website exactly
- [ ] Add photos, hours, services

### Social Media
- [ ] Update Instagram link in footer (currently `#` placeholder in `_booking-experience.tsx`)
