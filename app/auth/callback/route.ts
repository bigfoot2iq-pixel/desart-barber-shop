import { createClient } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';
import { getLocaleCookie } from '@/lib/i18n/locale-cookie';
import { i18n, type Locale } from '@/lib/i18n/config';
import { match } from '@formatjs/intl-localematcher';
import Negotiator from 'negotiator';

function sanitizeNextPath(raw: string | null): string {
  if (!raw) return '/dashboard';
  if (!/^\/[^/\\]/.test(raw)) return '/dashboard';
  return raw;
}

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

function withLocale(request: NextRequest, path: string): string {
  if (path.startsWith('/auth/')) return path;
  const locale = getPreferredLocale(request);
  if (path.startsWith(`/${locale}/`) || path === `/${locale}`) {
    return path;
  }
  return `/${locale}${path}`;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = sanitizeNextPath(searchParams.get('next'));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${withLocale(request, next)}`);
    }
  }

  return NextResponse.redirect(`${origin}${withLocale(request, '/auth/auth-code-error')}`);
}
