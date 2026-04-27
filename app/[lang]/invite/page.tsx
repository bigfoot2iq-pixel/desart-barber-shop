import { notFound } from 'next/navigation';
import type { Locale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { DictionaryProvider } from '@/lib/i18n/client-dictionary';
import InviteClient from './InviteClient';
import { createServiceClient } from '@/lib/supabase/service';
import type { InvitationToken } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

type ValidationResult =
  | { status: 'valid'; email: string; role: 'admin' | 'professional'; invitedByEmail: string; expiresAt: string }
  | { status: 'expired' }
  | { status: 'accepted' }
  | { status: 'not_found' };

const NOT_FOUND: ValidationResult = { status: 'not_found' };
const EXPIRED: ValidationResult = { status: 'expired' };
const ACCEPTED: ValidationResult = { status: 'accepted' };

async function validateToken(token: string): Promise<ValidationResult> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('invitation_tokens')
    .select('id, email, role, token, invited_by, expires_at, used_at, created_at')
    .eq('token', token)
    .single();

  if (error || !data) {
    return NOT_FOUND;
  }

  const row = data as InvitationToken;

  if (row.used_at) {
    return ACCEPTED;
  }

  if (new Date(row.expires_at) < new Date()) {
    return EXPIRED;
  }

  const { data: inviterProfile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', row.invited_by)
    .single();

  return {
    status: 'valid',
    email: row.email,
    role: row.role,
    invitedByEmail: (inviterProfile as { email?: string } | null)?.email ?? 'Unknown',
    expiresAt: row.expires_at,
  };
}

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>
  searchParams: Promise<{ token?: string }>
}) {
  const { lang } = await params;
  const { token } = await searchParams;

  const locale = lang as Locale;

  if (!lang || (lang !== 'fr' && lang !== 'en')) {
    notFound();
  }

  const [common] = await Promise.all([
    getDictionary(locale, 'common'),
  ]);

  let validation: ValidationResult = NOT_FOUND;
  if (token) {
    validation = await validateToken(token);
  }

  return (
    <DictionaryProvider value={{ common }}>
      <InviteClient
        validation={validation}
        token={token ?? null}
        lang={locale}
      />
    </DictionaryProvider>
  );
}