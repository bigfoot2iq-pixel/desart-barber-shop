import type { Metadata } from 'next';
import Script from 'next/script';
import { Playfair_Display, DM_Sans, Geist, Fraunces } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import '../globals.css';
import { cn } from '@/lib/utils';
import { hasLocale, type Locale } from '@/lib/i18n/config';
import { notFound } from 'next/navigation';
import { getDictionary } from '@/lib/i18n/get-dictionary';

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

  const baseUrl = 'https://www.desart.ma';
  const canonical = `${baseUrl}/${lang}`;

  return {
    title: meta.title ?? 'DESART',
    description: meta.description ?? '',
    icons: {
      icon: '/logo.jpg',
    },
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical,
      languages: {
        fr: '/fr',
        en: '/en',
        'x-default': '/',
      },
    },
    openGraph: {
      title: meta.title ?? 'DESART — Premium Barbershop',
      description: meta.description ?? '',
      url: canonical,
      siteName: 'DESART',
      images: [
        {
          url: '/og-image.jpg',
          width: 1200,
          height: 630,
          alt: 'DESART — Premium Barbershop in Agadir',
        },
      ],
      locale: lang === 'fr' ? 'fr_MA' : 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: meta.title ?? 'DESART — Premium Barbershop',
      description: meta.description ?? '',
      images: ['/og-image.jpg'],
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

  const baseUrl = 'https://www.desart.ma';

  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'DESART',
    url: baseUrl,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${baseUrl}/${lang}?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };

  const localBusinessJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HairSalon',
    name: 'DESART',
    image: `${baseUrl}/logo.jpg`,
    url: `${baseUrl}/${lang}`,
    telephone: '+212612213324',
    priceRange: '$$',
    paymentAccepted: 'Cash',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Agadir',
      addressCountry: 'MA',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 30.4278,
      longitude: -9.5981,
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Saturday', 'Sunday'],
        opens: '09:00',
        closes: '17:00',
      },
    ],
    areaServed: {
      '@type': 'City',
      name: 'Agadir',
    },
    sameAs: [],
  };

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
