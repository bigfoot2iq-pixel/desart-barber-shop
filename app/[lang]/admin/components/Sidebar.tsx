'use client';

import { useT } from '@/lib/i18n/client-dictionary';
import type { Locale } from '@/lib/i18n/config';
import { LocaleSwitcher } from '@/app/components/locale-switcher';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import Link from 'next/link';


export type Section = 'dashboard' | 'appointments' | 'professionals' | 'services' | 'salons' | 'notifications' | 'payment';

interface SidebarProps {
  active: Section;
  pendingCount: number;
  adminName: string;
  adminEmail: string;
  onSignOut: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  lang: Locale;
}

const navItems: { key: Section; icon: string; href: string }[] = [
  { key: 'dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1', href: '/admin' },
  { key: 'appointments', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', href: '/admin/appointments' },
  { key: 'professionals', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', href: '/admin/professionals' },
  { key: 'services', icon: 'M14.121 14.121L19 19m-4.879-4.879l-2.652 2.652a3 3 0 01-4.243 0l-.59-.59a3 3 0 010-4.243l2.652-2.652m4.833 4.833L9.9 9.9m4.833 4.833l2.652-2.652a3 3 0 000-4.243l-.59-.59a3 3 0 00-4.243 0l-2.652 2.652', href: '/admin/services' },
  { key: 'salons', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', href: '/admin/salons' },
  { key: 'notifications', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', href: '/admin/notifications' },
  { key: 'payment', icon: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z', href: '/admin/payment' },
];

function SidebarNav({ active, lang, pendingCount, onNavigate }: {
  active: Section;
  lang: Locale;
  pendingCount: number;
  onNavigate?: () => void;
}) {
  const tAdmin = useT('admin');

  return (
    <nav className="flex-1 px-3 py-4 space-y-1">
      {navItems.map((item) => (
        <Link
          key={item.key}
          href={`/${lang}${item.href}`}
          onClick={onNavigate}
          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
            active === item.key
              ? 'bg-primary/15 text-primary border-l-2 border-primary rounded-l-none rounded-r-lg'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          }`}
        >
          <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
          </svg>
          <span>{tAdmin(`nav.${item.key}`)}</span>
          {item.key === 'appointments' && pendingCount > 0 && (
            <span className="ml-auto bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full leading-none">
              {pendingCount}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}

export default function Sidebar({ active, pendingCount, adminName, adminEmail, onSignOut, mobileOpen, onMobileClose, lang }: SidebarProps) {
  const tAdmin = useT('admin');
  return (
    <>
      <aside className="hidden lg:flex flex-col w-[260px] bg-sidebar border-r border-sidebar-border h-screen sticky top-0">
        <SidebarDesktopHeader adminName={adminName} adminEmail={adminEmail} onSignOut={onSignOut} lang={lang} />
        <SidebarNav active={active} lang={lang} pendingCount={pendingCount} />
        <SidebarFooter adminName={adminName} adminEmail={adminEmail} onSignOut={onSignOut} lang={lang} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={(open) => { if (!open) onMobileClose(); }}>
        <SheetContent side="left" className="w-[260px] p-0" showCloseButton={false}>
          <SheetHeader className="px-6 py-6 border-b border-border">
            <SheetTitle className="font-playfair text-xl tracking-wider font-bold">DESART</SheetTitle>
            <p className="text-xs text-muted-foreground uppercase tracking-[0.2em] font-medium">{tAdmin('strapline')}</p>
            <div className="mt-3">
              <LocaleSwitcher locale={lang} variant="dark" />
            </div>
          </SheetHeader>
          <SidebarNav active={active} lang={lang} pendingCount={pendingCount} onNavigate={onMobileClose} />
          <div className="px-6 py-4 border-t border-border">
            <LocaleSwitcher locale={lang} variant="dark" />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function SidebarDesktopHeader({ adminName, adminEmail, onSignOut, lang }: {
  adminName: string;
  adminEmail: string;
  onSignOut: () => void;
  lang: Locale;
}) {
  const tAdmin = useT('admin');
  return (
    <div className="px-6 py-6 border-b border-border">
      <h1 className="font-playfair text-2xl text-foreground tracking-wider font-bold">DESART</h1>
      <p className="text-xs text-muted-foreground mt-1 uppercase tracking-[0.2em] font-medium">{tAdmin('strapline')}</p>
      <div className="mt-3">
        <LocaleSwitcher locale={lang} variant="dark" />
      </div>
    </div>
  );
}

function SidebarFooter({ adminName, adminEmail, onSignOut, lang }: {
  adminName: string;
  adminEmail: string;
  onSignOut: () => void;
  lang: Locale;
}) {
  const tAdmin = useT('admin');
  const tCommon = useT('common');
  const displayName = adminName || tAdmin('nav.adminFallback');
  return (
    <div className="px-4 py-4 border-t border-border space-y-3">
      <div className="px-1">
        <LocaleSwitcher locale={lang} variant="dark" />
      </div>
      <div className="flex items-center gap-3 mb-3 px-1">
        <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-playfair text-sm font-bold ring-1 ring-primary/25">
          {displayName?.charAt(0)?.toUpperCase() || 'A'}
        </div>
        <div className="min-w-0">
          <p className="text-sm text-foreground font-medium truncate">{displayName}</p>
          <p className="text-xs text-muted-foreground truncate">{adminEmail || ''}</p>
        </div>
      </div>
      <button
        onClick={onSignOut}
        className="w-full text-left px-4 py-2 text-sm text-muted-foreground hover:text-red-400 transition-colors duration-200 rounded-lg hover:bg-red-400/10"
      >
        {tCommon('signOut')}
      </button>
    </div>
  );
}
