import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

function sanitizeNextPath(raw: string | null): string {
  if (!raw) return '/dashboard';
  // Only allow local, non-protocol-relative paths: must start with "/"
  // and the next character must not be "/" or "\" (which browsers treat
  // as the start of a host in protocol-relative URLs like //evil.com).
  if (!/^\/[^/\\]/.test(raw)) return '/dashboard';
  return raw;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = sanitizeNextPath(searchParams.get('next'));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
