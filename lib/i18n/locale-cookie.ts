import { type Locale, i18n } from './config';

const COOKIE_NAME = 'NEXT_LOCALE';

export function getLocaleCookie(request: { cookies: { get(name: string): { value?: string } | undefined } }): Locale | undefined {
  const raw = request.cookies.get(COOKIE_NAME)?.value;
  if (raw && i18n.locales.includes(raw as Locale)) {
    return raw as Locale;
  }
  return undefined;
}

export function setLocaleCookie(response: { cookies: { set(name: string, value: string, options?: Record<string, unknown>): void } }, locale: Locale): void {
  response.cookies.set(COOKIE_NAME, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
}
