import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { Locale } from '@/lib/i18n/config';
import { i18n } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { getActiveServices } from '@/lib/queries/appointments';
import { ServicesContent } from './_services-content';
import { BASE_URL } from '@/lib/seo/constants';
import { buildBreadcrumbJsonLd, buildFaqJsonLd, buildServiceJsonLd } from '@/lib/seo/json-ld';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const locale = lang as Locale;
  if (locale !== 'fr' && locale !== 'en') return {};

  const dict = await getDictionary(locale, 'common');
  const page = (dict.servicesPage ?? {}) as Record<string, Record<string, string>>;
  const meta = page.meta ?? {};

  const canonical = `${BASE_URL}/${locale}/services`;

  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical,
      languages: {
        ...Object.fromEntries(i18n.locales.map((l) => [l, `/${l}/services`])),
        'x-default': `/${i18n.defaultLocale}/services`,
      },
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: canonical,
      siteName: 'DESART',
      images: [{ url: `${BASE_URL}/og-image.jpg`, width: 1200, height: 630 }],
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

  const breadcrumbJsonLd = buildBreadcrumbJsonLd(locale, [
    { position: 1, name: locale === 'fr' ? 'Accueil' : 'Home', url: `${BASE_URL}/${locale}` },
    { position: 2, name: locale === 'fr' ? 'Services' : 'Services', url: `${BASE_URL}/${locale}/services` },
  ]);

  const faqEntries = (['q1', 'q2', 'q3'] as const).map((q) => ({
    question: faqSection[q]?.question ?? '',
    answer: faqSection[q]?.answer ?? '',
  }));
  const faqJsonLd = buildFaqJsonLd(faqEntries);

  const servicesJsonLd = services.map((service) =>
    buildServiceJsonLd({
      name: service.name,
      description: service.description ?? undefined,
      price: service.price_mad,
      lang: locale,
    })
  );

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
