'use client';

import { useAuth } from '@/lib/auth-context';
import type { Locale } from '@/lib/i18n/config';

type ValidationResult =
  | { status: 'valid'; email: string; role: 'admin' | 'professional'; invitedByEmail: string; expiresAt: string }
  | { status: 'expired' }
  | { status: 'accepted' }
  | { status: 'not_found' };

interface InviteClientProps {
  validation: ValidationResult;
  token: string | null;
  lang: Locale;
}

function AcceptButton({ token, lang }: { token: string; lang: Locale }) {
  const { signInWithGoogle } = useAuth();

  const handleAccept = () => {
    signInWithGoogle(`/${lang}/invite/accept?token=${token}`);
  };

  return (
    <button
      onClick={handleAccept}
      className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors"
    >
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
      Accept & Sign in with Google
    </button>
  );
}

function formatExpiry(dateStr: string, lang: Locale): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function InviteClient({ validation, token, lang }: InviteClientProps) {
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="space-y-2">
            <h1 className="font-playfair text-3xl font-bold text-foreground">Invitation</h1>
            <p className="text-muted-foreground">No invitation token provided.</p>
          </div>
        </div>
      </div>
    );
  }

  if (validation.status === 'not_found') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="space-y-2">
            <h1 className="font-playfair text-3xl font-bold text-foreground">Invitation</h1>
            <p className="text-muted-foreground">This invitation could not be found. It may have been revoked or never existed.</p>
          </div>
        </div>
      </div>
    );
  }

  if (validation.status === 'accepted') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="space-y-2">
            <h1 className="font-playfair text-3xl font-bold text-foreground">Invitation</h1>
            <p className="text-muted-foreground">This invitation has already been used. Sign in to access your account.</p>
          </div>
        </div>
      </div>
    );
  }

  if (validation.status === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="space-y-2">
            <h1 className="font-playfair text-3xl font-bold text-foreground">Invitation Expired</h1>
            <p className="text-muted-foreground">This invitation has expired. Ask your admin for a new one.</p>
          </div>
        </div>
      </div>
    );
  }

  const { role, invitedByEmail, expiresAt } = validation;
  const roleLabel = role === 'admin' ? 'Administrator' : 'Professional';
  const expiryFormatted = formatExpiry(expiresAt, lang);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="space-y-2">
          <h1 className="font-playfair text-4xl font-bold text-foreground">You&apos;re Invited!</h1>
          <p className="text-muted-foreground text-lg">You have been invited to join our team.</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-4 text-left">
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Role</span>
              <span className="font-medium text-foreground">{roleLabel}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Invited by</span>
              <span className="font-medium text-foreground">{invitedByEmail}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Expires</span>
              <span className="font-medium text-foreground">{expiryFormatted}</span>
            </div>
          </div>
        </div>

        <AcceptButton token={token} lang={lang} />

        <p className="text-xs text-muted-foreground">You must sign in with the Google account that received this invitation.</p>
      </div>
    </div>
  );
}