import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { Locale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { getActiveProfessionals, getActiveServices } from '@/lib/queries/appointments';
import { HomeVisitContent } from './_home-visit-content';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const locale = lang as Locale;
  if (locale !== 'fr' && locale !== 'en') return {};

  const dict = await getDictionary(locale, 'common');
  const page = (dict.homeVisitPage ?? {}) as Record<string, Record<string, string>>;
  const meta = page.meta ?? {};

  const baseUrl = 'https://www.desart.ma';
  const canonical = `${baseUrl}/${locale}/a-domicile`;

  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical,
      languages: {
        fr: '/fr/a-domicile',
        en: '/en/a-domicile',
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

export default async function HomeVisitPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const locale = lang as Locale;

  if (locale !== 'fr' && locale !== 'en') {
    notFound();
  }

  const [common, booking, services, homeProfessionals] = await Promise.all([
    getDictionary(locale, 'common'),
    getDictionary(locale, 'booking'),
    getActiveServices(locale),
    getActiveProfessionals(locale, { offersHomeVisit: true }),
  ]);

  const homeVisitPage = (common.homeVisitPage ?? {}) as Record<string, Record<string, Record<string, string>>>;
  const heroDescription = homeVisitPage.hero?.description ?? '';
  const faqSection = homeVisitPage.faq ?? {};

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: locale === 'fr' ? 'Accueil' : 'Home', item: `https://www.desart.ma/${locale}` },
      { '@type': 'ListItem', position: 2, name: locale === 'fr' ? 'Service à Domicile' : 'Home Visit', item: `https://www.desart.ma/${locale}/a-domicile` },
    ],
  };

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: ['q1', 'q2', 'q3', 'q4'].map((q) => ({
      '@type': 'Question',
      name: faqSection[q]?.question ?? '',
      acceptedAnswer: {
        '@type': 'Answer',
        text: faqSection[q]?.answer ?? '',
      },
    })),
  };

  const serviceJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: locale === 'fr' ? 'Coiffeur à Domicile Agadir' : 'Home Haircut Agadir',
    description: heroDescription,
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
      price: '30',
      priceCurrency: 'MAD',
      description: locale === 'fr' ? 'Frais de déplacement' : 'Travel fee',
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }} />
      <HomeVisitContent
        locale={locale}
        common={common}
        booking={booking}
        services={services}
        professionals={homeProfessionals}
      />
    </>
  );
}
