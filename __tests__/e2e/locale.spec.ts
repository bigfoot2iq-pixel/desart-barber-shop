import { test, expect } from './fixtures';

const LOCALES = ['fr', 'en'] as const;

type Locale = (typeof LOCALES)[number];

const localeAssertions: Record<Locale, {
  heroHeadline: string;
  reserveCta: string;
  loginWelcome: string;
  loginContinueGoogle: string;
  userPanelMyBookings: string;
}> = {
  fr: {
    heroHeadline: 'Coupes précises.',
    reserveCta: 'Réserver une place',
    loginWelcome: 'Bon retour',
    loginContinueGoogle: 'Continuer avec Google',
    userPanelMyBookings: 'Mes réservations',
  },
  en: {
    heroHeadline: 'Sharp cuts.',
    reserveCta: 'Reserve a chair',
    loginWelcome: 'Welcome back',
    loginContinueGoogle: 'Continue with Google',
    userPanelMyBookings: 'My Bookings',
  },
};

for (const locale of LOCALES) {
  const assertions = localeAssertions[locale];

  test.describe.parallel(`Locale: ${locale}`, () => {
    test('landing page renders in correct locale', async ({ page }) => {
      await page.goto(`/${locale}`);
      await expect(page.locator('text=' + assertions.heroHeadline).first()).toBeVisible();
      await expect(page.locator('text=' + assertions.reserveCta).first()).toBeVisible();
    });

    test('login page renders in correct locale', async ({ page }) => {
      await page.goto(`/${locale}/login`);
      await expect(page.locator('h1:has-text("' + assertions.loginWelcome + '")')).toBeVisible();
      await expect(page.locator('button:has-text("' + assertions.loginContinueGoogle + '")')).toBeVisible();
    });

    test('locale switcher changes URL and cookie', async ({ page, context }) => {
      const other = locale === 'fr' ? 'en' : 'fr';

      await page.goto(`/${locale}`);
      await expect(page.locator('text=' + assertions.heroHeadline).first()).toBeVisible();

      // Click the other locale button in the switcher
      await page.locator(`button[aria-label*="Switch to ${other === 'fr' ? 'French' : 'English'}"]`).click();

      // Wait for navigation
      await page.waitForURL(`/${other}`, { waitUntil: 'networkidle' });

      // Verify content switched
      await expect(page.locator('text=' + localeAssertions[other].heroHeadline).first()).toBeVisible();

      // Verify cookie is set
      const cookies = await context.cookies();
      const localeCookie = cookies.find((c) => c.name === 'NEXT_LOCALE');
      expect(localeCookie?.value).toBe(other);
    });

    test('authenticated user panel shows localized text', async ({ authenticatedPage }) => {
      const page = authenticatedPage;
      await page.goto(`/${locale}`);

      // Open booking modal
      await page.getByTestId('btn:open-booking').first().click();
      await page.waitForSelector('[role="dialog"]', { state: 'visible' });

      // Click menu avatar button inside modal header
      await page.locator('button[aria-label*="Menu"]').first().click();

      // User panel should appear with localized text
      await expect(page.locator('text=' + assertions.userPanelMyBookings).first()).toBeVisible();
    });
  });
}
