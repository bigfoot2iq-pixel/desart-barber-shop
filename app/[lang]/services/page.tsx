import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { Locale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { getActiveServices } from '@/lib/queries/appointments';
import { ServicesContent } from './_services-content';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const locale = lang as Locale;
  if (locale !== 'fr' && locale !== 'en') return {};

  const dict = await getDictionary(locale, 'common');
  const page = (dict.servicesPage ?? {}) as Record<string, Record<string, string>>;
  const meta = page.meta ?? {};

  const baseUrl = 'https://www.desart.ma';
  const canonical = `${baseUrl}/${locale}/services`;

  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical,
      languages: {
        fr: '/fr/services',
        en: '/en/services',
      },
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: canonical,
      siteName: 'DESART',
      images: [{ url: '/og-image.jpg', width: 1200, height: 630 }],
      locale: locale === 'fr' ? 'fr_MA' : 'en_US',
      type: 'website',
    },
  };
}

export default async function ServicesPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const locale = lang as Locale;

  if (locale !== 'fr' && locale !== 'en') {
    notFound();
  }

  const [common, booking, services] = await Promise.all([
    getDictionary(locale, 'common'),
    getDictionary(locale, 'booking'),
    getActiveServices(locale),
  ]);

  const servicesPage = (common.servicesPage ?? {}) as Record<string, Record<string, Record<string, string>>>;
  const faqSection = servicesPage.faq ?? {};

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: locale === 'fr' ? 'Accueil' : 'Home', item: `https://www.desart.ma/${locale}` },
      { '@type': 'ListItem', position: 2, name: locale === 'fr' ? 'Services' : 'Services', item: `https://www.desart.ma/${locale}/services` },
    ],
  };

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: ['q1', 'q2', 'q3'].map((q) => ({
      '@type': 'Question',
      name: faqSection[q]?.question ?? '',
      acceptedAnswer: {
        '@type': 'Answer',
        text: faqSection[q]?.answer ?? '',
      },
    })),
  };

  const servicesJsonLd = services.map((service) => ({
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: service.name,
    description: service.description ?? undefined,
    provider: {
      '@type': 'HairSalon',
      name: 'DESART',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Agadir',
        addressCountry: 'MA',
      },
    },
    areaServed: { '@type': 'City', name: 'Agadir' },
    offers: {
      '@type': 'Offer',
      price: String(service.price_mad),
      priceCurrency: 'MAD',
    },
  }));

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      {servicesJsonLd.map((jsonLd, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      ))}
      <ServicesContent
        locale={locale}
        common={common}
        booking={booking}
        services={services}
      />
    </>
  );
}
