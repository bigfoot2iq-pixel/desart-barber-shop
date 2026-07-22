import { createClient } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';
import { getLocaleCookie } from '@/lib/i18n/locale-cookie';
import { i18n, type Locale } from '@/lib/i18n/config';
import { getRole } from '@/lib/roles';
import { match } from '@formatjs/intl-localematcher';
import Negotiator from 'negotiator';

function isValidNextPath(raw: string | null): raw is string {
  if (!raw) return false;
  return /^\/[^/\\]/.test(raw);
}

function getPreferredLocale(request: NextRequest): Locale {
  const cookieLocale = getLocaleCookie(request);
  if (cookieLocale && (i18n.publicLocales as readonly string[]).includes(cookieLocale)) {
    return cookieLocale;
  }

  const languages = new Negotiator({ headers: { 'accept-language': request.headers.get('accept-language') || undefined } }).languages();
  try {
    return match(languages, i18n.publicLocales as unknown as string[], i18n.defaultLocale) as Locale;
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
  return `/${locale}${path === '/' ? '' : path}`;
}

// Where to send a freshly signed-in user based on their role.
// Admin lands on the Arabic admin panel by default (admin panel is Arabic-first).
function destinationForUser(request: NextRequest, role: string | null): string {
  if (role === 'admin') return '/ar/admin';
  if (role === 'professional') return withLocale(request, '/professional');
  return withLocale(request, '/');
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const rawNext = searchParams.get('next');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // An explicit, safe `next` (e.g. the popup sign-in flow) always wins.
      if (isValidNextPath(rawNext)) {
        return NextResponse.redirect(`${origin}${withLocale(request, rawNext)}`);
      }
      const { data: { user } } = await supabase.auth.getUser();
      return NextResponse.redirect(`${origin}${destinationForUser(request, getRole(user))}`);
    }
  }

  return NextResponse.redirect(`${origin}${withLocale(request, '/auth/auth-code-error')}`);
}
