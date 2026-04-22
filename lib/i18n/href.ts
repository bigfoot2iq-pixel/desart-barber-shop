import type { Locale } from './config';
import { i18n } from './config';

export function localeHref(locale: Locale, path: string): string {
  if (path.startsWith('/')) {
    return `/${locale}${path}`;
  }
  return `/${locale}/${path}`;
}

export function stripLocalePrefix(pathname: string): string {
  const segments = pathname.split('/');
  if (segments[1] && (i18n.locales as readonly string[]).includes(segments[1])) {
    return pathname.replace(`/${segments[1]}`, '') || '/';
  }
  return pathname;
}
