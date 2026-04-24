import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { Locale } from '@/lib/i18n/config';
import { i18n } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { getActiveProfessionals, getActiveServices } from '@/lib/queries/appointments';
import { HomeVisitContent } from './_home-visit-content';
import { BASE_URL } from '@/lib/seo/constants';
import { buildBreadcrumbJsonLd, buildFaqJsonLd, buildServiceJsonLd } from '@/lib/seo/json-ld';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const locale = lang as Locale;
  if (locale !== 'fr' && locale !== 'en') return {};

  const dict = await getDictionary(locale, 'common');
  const page = (dict.homeVisitPage ?? {}) as Record<string, Record<string, string>>;
  const meta = page.meta ?? {};

  const canonical = `${BASE_URL}/${locale}/a-domicile`;

  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical,
      languages: {
        ...Object.fromEntries(i18n.locales.map((l) => [l, `/${l}/a-domicile`])),
        'x-default': `/${i18n.defaultLocale}/a-domicile`,
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

  const homeVisitPage = (common.homeVisitPage ?? {}) as Record<string, unknown>;
  const hero = homeVisitPage.hero as { description?: string } | undefined;
  const heroDescription = hero?.description ?? '';
  const faqSection = (homeVisitPage.faq ?? {}) as Record<string, { question?: string; answer?: string }>;

  const breadcrumbJsonLd = buildBreadcrumbJsonLd(locale, [
    { position: 1, name: locale === 'fr' ? 'Accueil' : 'Home', url: `${BASE_URL}/${locale}` },
    { position: 2, name: locale === 'fr' ? 'Service à Domicile' : 'Home Visit', url: `${BASE_URL}/${locale}/a-domicile` },
  ]);

  const faqEntries = (['q1', 'q2', 'q3', 'q4'] as const).map((q) => ({
    question: faqSection[q]?.question ?? '',
    answer: faqSection[q]?.answer ?? '',
  }));
  const faqJsonLd = buildFaqJsonLd(faqEntries);

  const serviceJsonLd = buildServiceJsonLd({
    name: locale === 'fr' ? 'Coiffeur à Domicile Agadir' : 'Home Haircut Agadir',
    description: heroDescription,
    lang: locale,
  });

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
