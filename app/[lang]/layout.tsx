import type { Metadata } from 'next';
import Script from 'next/script';
import { Playfair_Display, DM_Sans, Geist, Fraunces } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import '../globals.css';
import { cn } from '@/lib/utils';
import { hasLocale, type Locale, i18n } from '@/lib/i18n/config';
import { notFound } from 'next/navigation';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { BASE_URL, BUSINESS_NAME, PHONE, ADDRESS_LOCALITY, ADDRESS_COUNTRY, GEO_LATITUDE, GEO_LONGITUDE, PRICE_RANGE, PAYMENT_ACCEPTED, OPENING_HOURS, LOGO_URL, OG_IMAGE_URL } from '@/lib/seo/constants';
import { buildWebSiteJsonLd, buildLocalBusinessJsonLd } from '@/lib/seo/json-ld';

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

export async function generateMetadata({ params }: LayoutProps<'/[lang]'>): Promise<Metadata> {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale, 'common');
  const meta = (dict.meta ?? {}) as Record<string, string>;

  const canonical = `${BASE_URL}/${lang}`;

  return {
    title: meta.title ?? BUSINESS_NAME,
    description: meta.description ?? '',
    icons: {
      icon: LOGO_URL,
    },
    metadataBase: new URL(BASE_URL),
    alternates: {
      canonical,
      languages: {
        ...Object.fromEntries(i18n.locales.map((l) => [l, `/${l}`])),
        'x-default': `/${i18n.defaultLocale}`,
      },
    },
    openGraph: {
      title: meta.title ?? `${BUSINESS_NAME} — Premium Barbershop`,
      description: meta.description ?? '',
      url: canonical,
      siteName: BUSINESS_NAME,
      images: [
        {
          url: OG_IMAGE_URL,
          width: 1200,
          height: 630,
          alt: `${BUSINESS_NAME} — Premium Barbershop in Agadir`,
        },
      ],
      locale: lang === 'fr' ? 'fr_MA' : 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: meta.title ?? `${BUSINESS_NAME} — Premium Barbershop`,
      description: meta.description ?? '',
      images: [OG_IMAGE_URL],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    verification: {
      google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    },
  };
}

export const viewport = {
  width: 'device-width',
  initialScale: 1.0,
};

export async function generateStaticParams() {
  return i18n.locales.map((lang) => ({ lang }));
}

export default async function RootLayout({
  children,
  params,
}: LayoutProps<'/[lang]'>) {
  const { lang } = await params;

  if (!hasLocale(lang)) {
    notFound();
  }

  const websiteJsonLd = buildWebSiteJsonLd(lang);
  const localBusinessJsonLd = buildLocalBusinessJsonLd(lang);

  return (
    <html
      lang={lang}
      className={cn('h-full w-full scroll-smooth overflow-x-hidden antialiased', playfair.variable, dmSans.variable, fraunces.variable, 'font-sans', geist.variable)}
    >
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }} />
      </head>
      <body className="min-h-full flex flex-col bg-gold-bg text-brand-black font-dm-sans text-base leading-[1.65] overflow-x-hidden w-full">
        {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}');
              `}
            </Script>
          </>
        )}
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
