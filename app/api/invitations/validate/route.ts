import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import type { InvitationToken } from '@/lib/types/database';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'token is required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: invitation, error } = await supabase
    .from('invitation_tokens')
    .select('id, email, role, token, invited_by, expires_at, used_at, created_at')
    .eq('token', token)
    .single();

  if (error || !invitation) {
    return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
  }

  const row = invitation as InvitationToken;

  if (row.used_at) {
    return NextResponse.json({ error: 'Invitation already used' }, { status: 409 });
  }

  if (new Date(row.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Invitation has expired' }, { status: 410 });
  }

  const { data: inviterProfile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', row.invited_by)
    .single();

  const invitedByEmail = (inviterProfile as { email?: string } | null)?.email ?? 'Unknown';

  return NextResponse.json({
    email: row.email,
    role: row.role,
    invitedByEmail,
    expiresAt: row.expires_at,
  }, { status: 200 });
}