export const i18n = {
  // All routable locales. `ar` is admin-only (RTL) — see publicLocales for the
  // marketing site set. Adding it here makes /ar/* resolve and the admin panel
  // renders Arabic; the public site never auto-serves or links to it.
  locales: ['fr', 'en', 'ar'] as const,
  // Locales offered on the public marketing site (switcher, SEO hreflang,
  // Accept-Language matching). Arabic is intentionally excluded here.
  publicLocales: ['fr', 'en'] as const,
  defaultLocale: 'fr' as const,
};

export type Locale = (typeof i18n)['locales'][number];
export type PublicLocale = (typeof i18n)['publicLocales'][number];

export function hasLocale(locale: string): locale is Locale {
  return i18n.locales.includes(locale as Locale);
}

export function isPublicLocale(locale: string): locale is PublicLocale {
  return (i18n.publicLocales as readonly string[]).includes(locale);
}

// Text direction per locale. Only Arabic is RTL.
export function localeDir(locale: string): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}
