import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { buildInvitationMessage } from '@/lib/notifications/templates/invitation';
import { sendEmail } from '@/lib/notifications/channels/email-resend';
import type { InvitationToken } from '@/lib/types/database';

function computeStatus(row: InvitationToken): 'pending' | 'expired' | 'accepted' {
  if (row.used_at) return 'accepted';
  if (new Date(row.expires_at) < new Date()) return 'expired';
  return 'pending';
}

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('invitation_tokens')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []).map((row: InvitationToken) => {
    const { token: _token, ...rest } = row;
    return { ...rest, status: computeStatus(row) };
  });

  return NextResponse.json({ invitations: rows }, { status: 200 });
}

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { email, role } = body as { email?: string; role?: string };

  if (!email || typeof email !== 'string' || !email.trim()) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 });
  }
  if (!role || !['admin', 'professional'].includes(role)) {
    return NextResponse.json({ error: 'role must be admin or professional' }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from('invitation_tokens')
    .select('id, expires_at, used_at')
    .eq('email', email.trim().toLowerCase())
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (existing) {
    return NextResponse.json({ error: 'A pending invitation already exists for this email' }, { status: 409 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', user.id)
    .single();

  const inviterName = profile
    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
    : user.email || 'Admin';

  const { data: notificationSettings } = await supabase
    .from('customer_notification_settings')
    .select('resend_api_key, from_address, invitation_from_address')
    .limit(1)
    .maybeSingle();

  if (!notificationSettings?.resend_api_key) {
    return NextResponse.json({ error: 'Email service is not configured' }, { status: 422 });
  }

  const invitationFromAddress = notificationSettings.invitation_from_address || notificationSettings.from_address;
  if (!invitationFromAddress) {
    return NextResponse.json({ error: 'Invitation email address is not configured' }, { status: 422 });
  }

  const shopName = 'DESART Barber Shop';

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  const { data: invitation, error: insertError } = await supabase
    .from('invitation_tokens')
    .insert({
      email: email.trim().toLowerCase(),
      role,
      invited_by: user.id,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const inviteUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/fr/invite?token=${(invitation as InvitationToken).token}`;

  try {
    const message = await buildInvitationMessage({
      inviteUrl,
      role: role as 'admin' | 'professional',
      invitedByEmail: inviterName,
      expiresAt,
      shopName,
    });

    await sendEmail(
      {
        api_key: notificationSettings.resend_api_key,
        from: invitationFromAddress,
        to: email.trim().toLowerCase(),
      },
      message
    );
  } catch (err) {
    if (err instanceof Error && err.message === 'rate_limited') {
      return NextResponse.json({ error: 'Email service rate limit exceeded. Please try again later.' }, { status: 429 });
    }
    console.error('[invitations] failed to send email', err);
    return NextResponse.json({ error: 'Failed to send invitation email' }, { status: 500 });
  }

  const { token: _token, ...safeInvitation } = invitation as InvitationToken;
  return NextResponse.json({ invitation: { ...safeInvitation, status: 'pending' } }, { status: 201 });
}