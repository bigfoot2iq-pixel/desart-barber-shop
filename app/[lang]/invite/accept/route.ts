import { NextResponse, type NextRequest } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { localeHref } from '@/lib/i18n/href';
import type { Locale } from '@/lib/i18n/config';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL(localeHref('fr', '/?error=no_token'), request.url));
  }

  const supabaseUser = await createServerClient();
  const { data: { user } } = await supabaseUser.auth.getUser();

  if (!user) {
    const redirectUrl = new URL(localeHref('fr', `/invite?token=${token}`), request.url);
    return NextResponse.redirect(redirectUrl);
  }

  const supabase = createServiceClient();

  const { data: invitation, error } = await supabase
    .from('invitation_tokens')
    .select('id, email, role, token, invited_by, expires_at, used_at')
    .eq('token', token)
    .single();

  if (error || !invitation) {
    return NextResponse.redirect(new URL(localeHref('fr', '/?error=invitation_not_found'), request.url));
  }

  const invitationData = invitation as { id: string; email: string; role: string; token: string; invited_by: string; expires_at: string; used_at: string | null };

  if (invitationData.used_at) {
    return NextResponse.redirect(new URL(localeHref('fr', '/?error=invitation_already_used'), request.url));
  }

  if (new Date(invitationData.expires_at) < new Date()) {
    return NextResponse.redirect(new URL(localeHref('fr', `/invite?token=${token}&error=expired`), request.url));
  }

  if (invitationData.email !== user.email) {
    return NextResponse.redirect(new URL(localeHref('fr', '/?error=email_mismatch'), request.url));
  }

  const { error: updateAuthError } = await supabase.auth.admin.updateUserById(user.id, {
    app_metadata: { role: invitationData.role },
  });

  if (updateAuthError) {
    console.error('[invite/accept] failed to update auth metadata', updateAuthError);
    const redirectUrl = new URL(localeHref('fr', '/?error=update_failed'), request.url);
    return NextResponse.redirect(redirectUrl);
  }

  const profileUpdate: Record<string, unknown> = { role: invitationData.role };
  const { error: updateProfileError } = await supabase
    .from('profiles')
    .update(profileUpdate as never)
    .eq('id', user.id);

  if (updateProfileError) {
    // RLS policies key off profiles.role, so leaving it stale would
    // half-promote the user (page access works but every RLS query
    // fails).  Roll the auth metadata back so retrying the invite is
    // clean instead of leaving the account in a broken state.
    console.error('[invite/accept] failed to update profile role', updateProfileError);
    await supabase.auth.admin.updateUserById(user.id, {
      app_metadata: { role: 'customer' },
    });
    return NextResponse.redirect(new URL(localeHref('fr', '/?error=update_failed'), request.url));
  }

  const tokenUpdate: Record<string, unknown> = { used_at: new Date().toISOString() };
  const { error: markUsedError } = await supabase
    .from('invitation_tokens')
    .update(tokenUpdate as never)
    .eq('id', invitationData.id);

  if (markUsedError) {
    console.error('[invite/accept] failed to mark token as used', markUsedError);
  }

  const redirectLang = (user.app_metadata?.locale as Locale) || 'fr';
  const redirectPath = invitationData.role === 'admin' ? '/admin' : '/dashboard';
  const redirectUrl = new URL(localeHref(redirectLang, redirectPath), request.url);

  return NextResponse.redirect(redirectUrl);
}