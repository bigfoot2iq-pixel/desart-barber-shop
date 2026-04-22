import type { Metadata } from 'next';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import type { Locale } from '@/lib/i18n/config';

export async function generateMetadata({ params }: LayoutProps<'/[lang]'>) {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale, 'admin');
  const strapline = (dict.strapline ?? 'Admin') as string;

  return {
    title: `DESART — ${strapline}`,
  } satisfies Metadata;
}

const adminThemeVars: Record<string, string> = {
  '--background': '#000000',
  '--foreground': '#ffffff',
  '--card': '#141414',
  '--card-foreground': '#ffffff',
  '--popover': '#111111',
  '--popover-foreground': '#ffffff',
  '--primary': '#ffffff',
  '--primary-foreground': '#000000',
  '--secondary': '#222222',
  '--secondary-foreground': '#ffffff',
  '--muted': '#222222',
  '--muted-foreground': '#888888',
  '--accent': '#222222',
  '--accent-foreground': '#ffffff',
  '--destructive': '#ef4444',
  '--border': 'rgba(255,255,255,0.1)',
  '--input': 'rgba(255,255,255,0.15)',
  '--ring': '#666666',
  '--radius': '0.625rem',
  '--sidebar': '#1a1a1a',
  '--sidebar-foreground': '#ffffff',
  '--sidebar-primary': '#ffffff',
  '--sidebar-primary-foreground': '#000000',
  '--sidebar-accent': '#222222',
  '--sidebar-accent-foreground': '#ffffff',
  '--sidebar-border': 'rgba(255,255,255,0.08)',
  '--sidebar-ring': '#666666',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark min-h-screen bg-background text-foreground" style={adminThemeVars}>
      {children}
    </div>
  );
}