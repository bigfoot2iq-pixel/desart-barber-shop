'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import type { Locale } from '@/lib/i18n/config';
import { useT } from '@/lib/i18n/client-dictionary';
import Sidebar, { type Section } from './Sidebar';
import { ToastProvider } from './ui';

interface AdminShellProps {
  lang: Locale;
  section: Section;
  pendingCount: number;
  adminName: string;
  adminEmail: string;
  children: React.ReactNode;
}

export default function AdminShell({ lang, section, pendingCount, adminName, adminEmail, children }: AdminShellProps) {
  const { signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const tAdmin = useT('admin');

  return (
    <div className="flex min-h-screen">
      <Sidebar
        active={section}
        pendingCount={pendingCount}
        adminName={adminName}
        adminEmail={adminEmail}
        onSignOut={signOut}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
        lang={lang}
      />

      <main className="flex-1 min-w-0">
        <div className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border px-4 lg:px-8 py-4 flex items-center gap-4">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <h2 className="font-playfair text-lg text-foreground font-semibold">{tAdmin(`nav.${section}`)}</h2>
          <div className="ml-auto flex items-center gap-3 lg:hidden">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-playfair text-sm font-bold ring-1 ring-primary/25">
              {adminName?.charAt(0)?.toUpperCase() || 'A'}
            </div>
          </div>
        </div>

        <div className="px-4 lg:px-8 py-6">
          <ToastProvider>
            {children}
          </ToastProvider>
        </div>
      </main>
    </div>
  );
}
