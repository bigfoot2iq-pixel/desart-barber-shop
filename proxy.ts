import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { match } from '@formatjs/intl-localematcher';
import Negotiator from 'negotiator';
import { i18n, hasLocale, type Locale } from '@/lib/i18n/config';
import { getLocaleCookie, setLocaleCookie } from '@/lib/i18n/locale-cookie';

function getPreferredLocale(request: NextRequest): Locale {
  const cookieLocale = getLocaleCookie(request);
  if (cookieLocale) return cookieLocale;

  const languages = new Negotiator({ headers: { 'accept-language': request.headers.get('accept-language') || undefined } }).languages();
  try {
    return match(languages, i18n.locales as unknown as string[], i18n.defaultLocale) as Locale;
  } catch {
    return i18n.defaultLocale;
  }
}

function shouldSkipLocaleRedirect(pathname: string): boolean {
  if (pathname.startsWith('/api/')) return true;
  if (pathname.startsWith('/auth/')) return true;
  if (pathname.startsWith('/_next/')) return true;
  if (pathname.startsWith('/_vercel/')) return true;
  if (pathname.includes('.')) return true;
  return false;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (shouldSkipLocaleRedirect(pathname)) {
    return await updateSession(request);
  }

  const pathLocale = pathname.split('/')[1];
  const locale = hasLocale(pathLocale) ? pathLocale : undefined;

  if (!locale) {
    const preferred = getPreferredLocale(request);
    const redirectUrl = new URL(`/${preferred}${pathname === '/' ? '' : pathname}`, request.url);
    const supabaseResponse = await updateSession(request);
    const redirectResponse = NextResponse.redirect(redirectUrl);

    // Preserve Supabase session cookies on the redirect response
    supabaseResponse.cookies.getAll().forEach(({ name, value }) => {
      redirectResponse.cookies.set(name, value);
    });

    setLocaleCookie(redirectResponse, preferred);
    return redirectResponse;
  }

  const response = await updateSession(request);
  setLocaleCookie(response, locale);
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
