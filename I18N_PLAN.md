# Multi-language Support Plan (EN + FR)

> Implementor brief: **read `node_modules/next/dist/docs/01-app/02-guides/internationalization.md` first** — this is Next.js 16, and APIs (`proxy.ts`, `PageProps<'/[lang]'>`, `await params`) differ from training data. Every code sample below assumes you've read that file.

## 1. Scope & goals

- **Locales:** `fr` (default, primary market is Agadir), `en` (fallback). Structure must accept `ar` later without refactor (RTL aware).
- **Routing:** subpath `/fr/...`, `/en/...`. Root `/` redirects via proxy based on `Accept-Language`, then cookie-pinned.
- **Zero runtime JS for dictionaries** where possible — server components fetch translated strings; client components receive them as props or via a narrow context.
- **No new heavy library.** Follow the Next.js docs pattern (dictionary files + `getDictionary`) plus `@formatjs/intl-localematcher` + `negotiator` for `Accept-Language` matching. Do **not** add `next-intl` unless a justification emerges during Phase 3.
- **Keep admin panel localized** (FR/EN toggle) — the Moroccan staff use French natively.

## 2. Non-goals

- Arabic / RTL this iteration. Structure must not foreclose it, but do not implement it.
- Machine translation pipeline. Human-authored dictionaries only.
- Locale-specific domains (`.fr` / `.ma`). Subpath routing only.

## 3. Architecture overview

```
app/
  [lang]/
    layout.tsx                  # reads lang, sets <html lang>, loads base dict
    page.tsx                    # server wrapper → passes dict to client booking flow
    login/page.tsx
    admin/...                   # moved under [lang]
    professional/page.tsx
    dashboard/page.tsx
  api/                          # NOT under [lang] — APIs are locale-agnostic
  auth/callback/...             # NOT under [lang] — OAuth callback stays flat
  layout.tsx                    # minimal pass-through (optional: delete if [lang]/layout covers)

lib/
  i18n/
    config.ts                   # LOCALES, DEFAULT_LOCALE, Locale type, hasLocale guard
    dictionaries/
      fr/
        common.json             # nav, buttons, errors, generic labels
        booking.json            # the 2293-line booking flow strings
        admin.json
        user-panel.json
        notifications.json      # customer-facing email/SMS/WhatsApp templates
      en/
        (mirror of fr/)
    get-dictionary.ts           # server-only loader, namespace-scoped
    format.ts                   # formatDate / formatTime / formatMoney via Intl.*
    client-dictionary.tsx       # React context for client-only subtrees
    locale-cookie.ts            # NEXT_LOCALE cookie helpers
proxy.ts                        # extended: locale detect + redirect + existing Supabase session
```

### Key decisions

1. **Namespace-split dictionaries.** One JSON per feature area. Avoid loading `booking.json` in admin pages. Keeps client bundle small when dicts are passed to client components.
2. **Server-first, prop-down.** Server components call `getDictionary(lang, 'booking')`, then pass the resolved object as a prop to the "use client" tree. No translation lookup runs in the browser.
3. **Client context only where necessary.** Deep client trees (e.g. `app/page.tsx`'s booking wizard) get a tiny `<DictionaryProvider>` wrapping the single server→client boundary, exposing `useT('key.path')`. Only the relevant namespace object lives there — not the whole catalog.
4. **No ICU/plurals library.** Use `Intl.PluralRules` directly for the handful of plural keys (e.g. "1 service" / "2 services"). Keys are authored as `{ services_one, services_other }` per CLDR.
5. **DB content i18n via sibling columns.** Add `name_fr`, `description_fr` (nullable) to `services`, plus `name_fr` on `salons`. Fall back to the base column when the `_fr` variant is null. Chosen over JSONB because:
   - RLS and Postgres search are simpler against plain columns.
   - Admin form stays a flat two-field UI per locale.
   - We only support two languages for the foreseeable future.
   - Upgrade path to JSONB is mechanical if `ar` lands.
6. **Dates / numbers / currency** always through `lib/i18n/format.ts` helpers. Delete `MONTHS` array, `toHHMM` where user-facing, existing `formatDate/formatTime` in `lib/notifications/types.ts`.
7. **Locale cookie `NEXT_LOCALE`** set by proxy on redirect and by an explicit `<LocaleSwitcher>` component. Cookie beats `Accept-Language` on subsequent requests.

## 4. Phased implementation

Each phase ends with a working, shippable app. Do not skip phases.

---

### Phase 1 — Scaffolding (no user-visible change)

**Goal:** i18n plumbing exists and renders English from dictionaries, but UI is unchanged.

1. **Install deps**
   ```
   pnpm add @formatjs/intl-localematcher negotiator
   pnpm add -D @types/negotiator
   ```
2. **Create `lib/i18n/config.ts`**
   ```ts
   export const LOCALES = ['fr', 'en'] as const;
   export type Locale = (typeof LOCALES)[number];
   export const DEFAULT_LOCALE: Locale = 'fr';
   export const hasLocale = (v: string): v is Locale =>
     (LOCALES as readonly string[]).includes(v);
   ```
3. **Create `lib/i18n/get-dictionary.ts`** (server-only, namespace-keyed):
   ```ts
   import 'server-only';
   import type { Locale } from './config';
   type Namespace = 'common' | 'booking' | 'admin' | 'userPanel' | 'notifications';
   const loaders = {
     fr: {
       common: () => import('./dictionaries/fr/common.json').then(m => m.default),
       booking: () => import('./dictionaries/fr/booking.json').then(m => m.default),
       // ...
     },
     en: { /* mirror */ },
   } as const;
   export async function getDictionary<N extends Namespace>(
     locale: Locale, ns: N,
   ): Promise<(typeof loaders)['fr'][N] extends () => Promise<infer R> ? R : never> {
     return loaders[locale][ns]();
   }
   ```
4. **Create `lib/i18n/format.ts`** wrapping `Intl.DateTimeFormat`, `Intl.NumberFormat` (currency `MAD`, hour12 per locale — FR uses 24h, EN uses 12h).
5. **Create empty dictionary JSON files** for both locales, populate `common` only (nav, buttons, generic "Loading…", "Cancel", "Save"). Leave other namespaces as `{}` for now.
6. **Extend `proxy.ts`** — **order matters**:
   - Skip locale logic for `/api/*`, `/auth/*`, `/_next/*`, static file extensions (match current matcher exclusions).
   - If pathname already has a locale prefix: `return updateSession(request)` unchanged.
   - Else: detect via `NEXT_LOCALE` cookie → `Accept-Language` → `DEFAULT_LOCALE`, then `NextResponse.redirect` to `/{locale}${pathname}`.
   - Redirect response must preserve the Supabase session cookies from `updateSession`.
7. **Create `app/[lang]/layout.tsx`**
   - Accepts `PageProps<'/[lang]'>`, awaits `params`, calls `hasLocale(lang) || notFound()`.
   - Sets `<html lang={lang}>`. This replaces the hardcoded `lang="en"` in the current root layout.
   - Keeps `AuthProvider`, fonts, and global CSS import.
   - Exports `generateStaticParams` returning both locales.
8. **Move files under `[lang]/`:**
   - `app/page.tsx` → `app/[lang]/page.tsx`
   - `app/login/page.tsx` → `app/[lang]/login/page.tsx`
   - `app/admin/**` → `app/[lang]/admin/**`
   - `app/professional/page.tsx` → `app/[lang]/professional/page.tsx`
   - `app/dashboard/page.tsx` → `app/[lang]/dashboard/page.tsx`
   - **Do NOT move** `app/api/**`, `app/auth/callback/**`, `app/auth/popup-callback/**`.
   - **Do NOT move** `app/components/**` (it's a component folder, not a route).
9. **Update internal links.** Every `Link`/`router.push` needs the locale prefix. Add `lib/i18n/href.ts` with `localeHref(locale, path)` helper and a `<LocalizedLink>` wrapper that reads locale from context. Grep targets: `href="/`, `router.push('/`, `redirect('/`, `NextResponse.redirect`. OAuth redirect URLs in `app/auth/callback` must redirect to `/${locale}/...`.
10. **Smoke test:** `pnpm dev`, hit `/` → expect redirect to `/fr`. Hit `/en`, `/fr`, `/en/admin`, `/fr/login`. Existing auth flow must still work end-to-end.

**Exit criteria:** All routes render identically to before, but under `/fr` or `/en`, and `<html lang>` matches the URL.

---

### Phase 2 — Extract strings (`common` + `booking`)

**Goal:** Landing page + booking wizard (`app/[lang]/page.tsx`) fully localized; FR renders real French.

1. **Grep the 2293-line `app/[lang]/page.tsx` for literal strings.** Catalog them in `lib/i18n/dictionaries/en/booking.json` with nested keys mirroring UI structure: `steps.location.title`, `steps.barber.cta`, `hero.marquee.0` … `marquee.11`, `validation.phone.required`, etc.
2. **Convert the page to server wrapper + client child pattern:**
   - New `app/[lang]/page.tsx` (server): awaits `params`, calls `getDictionary(lang, 'common')` and `getDictionary(lang, 'booking')`, fetches the existing Supabase data, and renders `<BookingExperience lang={lang} dict={bookingDict} commonDict={commonDict} ...dataProps />`.
   - Move the current "use client" body into `app/[lang]/_booking-experience.tsx`.
   - The client component wraps itself in `<DictionaryProvider value={{booking, common}}>`.
3. **Introduce `useT` hook** (`lib/i18n/client-dictionary.tsx`):
   ```ts
   export function useT<N extends Namespace>(ns: N) {
     const dict = useContext(DictionaryContext)[ns];
     return (key: string, vars?: Record<string, string | number>) =>
       interpolate(resolvePath(dict, key), vars);
   }
   ```
   Interpolation: `{name}` → replace; `{count, plural, one {...} other {...}}` deliberately **not** supported — use two keys + `Intl.PluralRules` at the call site.
4. **Replace literals** with `t('...')` calls. The `STEP_LABELS`, `MONTHS`, `MARQUEE_ITEMS` constants: move into the dictionary.
5. **Replace date/time/money formatting** with `lib/i18n/format.ts` helpers. The booking time picker currently builds labels from raw `HH:MM` — feed the base date through `formatTime(d, locale)`.
6. **Translate FR dictionary.** The FR booking JSON is the big content deliverable for this phase — every key from `en/booking.json` gets a French counterpart. Commit both in one PR so they never drift.
7. **Write a dictionary-parity test** in `__tests__/i18n/parity.test.ts`: walks all JSON files, asserts both locales have identical key sets. Fail the build if drift.
8. **Validation:** boot app in both locales, click through the entire 5-step booking wizard. Submit a test booking. Verify the confirmation toast, validation errors, and marquee all render in the selected language.

---

### Phase 3 — Remaining surfaces

Apply the Phase 2 pattern to each of these, one per PR:

- `app/[lang]/login/page.tsx` — dictionary: `common` additions.
- `components/user-panel/**` — new namespace `userPanel`. The user panel is mounted from the landing page; it's already a client tree, so pass dict through props when rendering `<UserPanel>` from the server wrapper, then re-use `useT('userPanel')`.
- `app/[lang]/dashboard/page.tsx`, `app/[lang]/professional/page.tsx` — whichever namespace fits.
- `app/[lang]/admin/**` — new namespace `admin`. Touches many files (`Sidebar.tsx` nav labels, each `*Manager.tsx` form labels, toasts, empty states).

For each PR: extract to EN dict → write FR dict → replace literals → smoke test both locales.

---

### Phase 4 — Database content

**Migration `019_i18n_service_salon_columns.sql`:**
```sql
alter table public.services
  add column name_fr text,
  add column description_fr text;
alter table public.salons
  add column name_fr text,
  add column address_fr text;
```
Nullable — existing rows keep English in the base column; `_fr` backfilled manually via the admin UI.

**Query layer (`lib/queries/`):**
- Accept a `locale` parameter on read functions.
- Resolve via `locale === 'fr' ? (row.name_fr ?? row.name) : row.name` in a `localizeRow(row, locale)` helper.
- Keep writes targeting the underlying columns (admin UI exposes both fields).

**Admin UI (`ServicesManager.tsx`, `SalonsManager.tsx`):**
- Add a tabbed EN/FR input set in the edit modal. Both fields optional (FR falls back to EN).
- Surface a "Translation missing" badge on list rows where `_fr` is null, so admins know what still needs work.

**Server components** pass `lang` into query calls. The landing page's service list / salon list now renders localized content.

---

### Phase 5 — Notifications & emails

**Customer-facing templates** (`lib/notifications/templates/customer/*`):
- Each template function gains a `locale: Locale` parameter.
- Split the body builders: `buildPlainText(apt, locale)`, `buildHtml(apt, locale)`.
- Pull strings from `lib/i18n/dictionaries/{fr,en}/notifications.json`. Keep HTML skeleton in the template file; only text moves to JSON.
- Dates/times formatted via `lib/i18n/format.ts` (drop the local `formatDate`/`formatTime` in `lib/notifications/types.ts` — keep `formatPhone`).
- WhatsApp Cloud: parameters are positional — keep the array order stable across locales; the template approved in Meta Business determines the language, so you'll need two approved templates (one per locale) and a locale→template-name mapping in `lib/notifications/channels/whatsapp-cloud.ts`.

**Locale source for notifications:**
- Add `locale` column to `profiles` (migration `020_profile_locale.sql`, default `'fr'`).
- Booking flow writes the current UI locale onto the customer's profile (upsert).
- Dispatch layer (`lib/notifications/customer-dispatch.ts`) reads `profile.locale` and passes it to the template.
- Staff templates: resolve locale per staff profile; admin Telegram channel can default to FR.

---

### Phase 6 — Locale switcher & polish

1. `<LocaleSwitcher>` component in the landing page header and admin sidebar. Writes `NEXT_LOCALE` cookie, `router.replace` to the same path under the new locale prefix.
2. `metadata` in `app/[lang]/layout.tsx` uses `generateMetadata({ params })` — localized title/description, `alternates.languages` with hreflang for `fr`, `en`, and `x-default`.
3. Playwright E2E: a test file per locale covering the booking happy path + user-panel sign-in. Parameterize with `test.describe.parallel` over `LOCALES`.
4. Jest: parity test from Phase 2 guards all namespaces now.
5. Remove the old top-level `app/layout.tsx` hardcoded `lang="en"` once `app/[lang]/layout.tsx` is authoritative (or keep it as a pass-through with no `<html>` tag — decide based on whether Next 16 requires a root layout at the top level; the docs file you read answers this).

---

## 5. Risks & open questions
| Risk | Mitigation |
| --- | --- |
| `app/page.tsx` is one 2293-line client component — splitting it to add a server wrapper may destabilize stateful behavior. | Do the split as a mechanical no-op commit first (Phase 2 step 2), verify booking still works, then extract strings in a second commit. |
| OAuth callback URLs registered in Supabase must match redirect paths. | Keep `/auth/callback` outside `[lang]` and add the locale prefix only when redirecting the user into the app after callback completes. |
| SEO loss when moving from `/` to `/fr`. | `generateStaticParams` + 301 redirects from proxy (not 302) once launched; add `hreflang` alternates; submit new sitemap. |
| FR translations authored by developer are often wrong for salon/service wording. | Gate the FR launch behind a review by the salon owner; the `_fr` columns default to null so nothing ships half-translated. |
| `@formatjs/intl-localematcher` + `negotiator` is Node-only — proxy runs in Edge by default. | Per Next 16 docs, both work in Edge. If not, replace with a 20-line hand-rolled `Accept-Language` parser (quality values are overkill for two locales). |
| Prefetch of a locale-less link in the proxy causes redirect loops. | In proxy, skip the locale branch when `request.headers.get('next-router-prefetch')` is present, or when the path is already a known locale prefix — both handled by the "pathname starts with `/{locale}`" check. |

## 6. Rollout order (for tracking)

- [x] Phase 1 — scaffolding
- [x] Phase 2 — landing + booking
- [x] Phase 3a — login
- [x] Phase 3b — user panel
- [x] Phase 3c — admin panel
- [x] Phase 3d — professional + dashboard
- [x] Phase 4 — DB content columns + admin editor
- [x] Phase 5 — notifications (customer, then staff)
- [x] Phase 6 — switcher, metadata, E2E, cutover

Each phase ships independently. After Phase 2 the app already serves real French to the highest-traffic surface; everything after is incremental.
