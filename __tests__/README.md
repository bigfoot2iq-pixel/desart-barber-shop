# Test Suite

Three test layers, each with its own environment requirements.

## Layer 1 — Unit tests (`pnpm test`)

Pure functions only. No network, no database.

| Env var | Required? | Purpose |
|---------|-----------|---------|
| *(none)* | — | Unit tests read no env vars. |

## Layer 2 — Integration / security tests (`pnpm test:security`)

Run against a **live Supabase** instance. Create real auth users, seed real DB rows.

| Env var | Required? | Purpose |
|---------|-----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Anon/public key for read operations |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Admin key for user creation, seeding, cleanup |
| `NOTIFICATIONS_WEBHOOK_SECRET` | No | Not used by tests |

Tests are skipped (not failed) when `SUPABASE_SERVICE_ROLE_KEY` is absent.

## Layer 3 — E2E tests (`pnpm test:e2e`)

Playwright runs a real browser against `pnpm dev`. Auth sessions are injected via `localStorage`. Google OAuth is stubbed.

| Env var | Required? | Purpose |
|---------|-----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL (used by fixtures for admin user creation + session token retrieval) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Anon key (used to sign in test users and obtain tokens) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Admin key (create/delete test users, seed/clean bookings) |
| `BASE_URL` | No | Override the dev server URL. Default: `http://localhost:3000` |

### Running E2E tests

```bash
# Install browsers (first time only)
pnpm exec playwright install chromium

# Run all E2E specs
pnpm test:e2e

# Run only the desktop project
pnpm test:e2e --project=desktop

# Run only the mobile project
pnpm test:e2e --project=mobile

# Run a single spec
pnpm test:e2e booking-time-step.spec.ts

# Run with UI (headed mode)
pnpm test:e2e --headed

# Open Playwright UI for debugging
pnpm exec playwright test --ui
```

### How auth works in E2E

1. `fixtures.ts` creates a confirmed Supabase user via the admin API.
2. Signs them in with `signInWithPassword` to obtain access + refresh tokens.
3. Injects the session into the page's `localStorage` under the Supabase auth key.
4. The Supabase client in the app reads the session from `localStorage` on load.
5. `signInWithGoogleModal` is stubbed — no Google OAuth popup is ever opened.

### Regression gate

Case **12.1** (same-user double-book) is the regression gate for migration 014.
It **must fail** if the `appointments_no_barber_overlap` exclusion constraint is reverted.
