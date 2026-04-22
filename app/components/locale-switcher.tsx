'use client';

import { useRouter, usePathname } from 'next/navigation';
import type { Locale } from '@/lib/i18n/config';
import { i18n } from '@/lib/i18n/config';
import { localeHref, stripLocalePrefix } from '@/lib/i18n/href';
import { setLocaleCookieClient } from '@/lib/i18n/locale-cookie';

interface LocaleSwitcherProps {
  locale: Locale;
  variant?: 'light' | 'dark';
}

export function LocaleSwitcher({ locale, variant = 'light' }: LocaleSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleSwitch = (next: Locale) => {
    if (next === locale) return;
    const stripped = stripLocalePrefix(pathname);
    setLocaleCookieClient(next);
    router.replace(localeHref(next, stripped));
  };

  const baseClasses =
    variant === 'light'
      ? 'text-brand-white/50 hover:text-brand-white data-[active=true]:text-gold3'
      : 'text-muted-foreground hover:text-foreground data-[active=true]:text-foreground';

  return (
    <div className="inline-flex items-center gap-1 text-[11px] font-medium tracking-[0.14em] uppercase">
      {i18n.locales.map((l, index) => (
        <span key={l} className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleSwitch(l)}
            data-active={locale === l}
            className={`px-1.5 py-0.5 rounded transition-colors duration-200 ${baseClasses}`}
            aria-label={`Switch to ${l === 'fr' ? 'French' : 'English'}`}
            aria-pressed={locale === l}
          >
            {l}
          </button>
          {index < i18n.locales.length - 1 && (
            <span
              className={
                variant === 'light' ? 'text-brand-white/20' : 'text-border'
              }
            >
              /
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
