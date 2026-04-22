import type { Metadata } from 'next';
import { Playfair_Display, DM_Sans, Geist, Fraunces } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import '../globals.css';
import { cn } from '@/lib/utils';
import { hasLocale, type Locale } from '@/lib/i18n/config';
import { notFound } from 'next/navigation';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-fraunces',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'DESART — Premium Barbershop',
  description: 'Premium barbershop landing page for Desart in Agadir.',
  icons: {
    icon: '/logo.jpg',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1.0,
};

export async function generateStaticParams() {
  return [{ lang: 'fr' }, { lang: 'en' }];
}

export default async function RootLayout({
  children,
  params,
}: LayoutProps<'/[lang]'>) {
  const { lang } = await params;

  if (!hasLocale(lang)) {
    notFound();
  }

  return (
    <html
      lang={lang}
      className={cn('h-full w-full scroll-smooth overflow-x-hidden antialiased', playfair.variable, dmSans.variable, fraunces.variable, 'font-sans', geist.variable)}
    >
      <body className="min-h-full flex flex-col bg-gold-bg text-brand-black font-dm-sans text-base leading-[1.65] overflow-x-hidden w-full">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
