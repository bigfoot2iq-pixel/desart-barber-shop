import { BASE_URL, BUSINESS_NAME, PHONE, ADDRESS_LOCALITY, ADDRESS_COUNTRY, GEO_LATITUDE, GEO_LONGITUDE, PRICE_RANGE, PAYMENT_ACCEPTED, OPENING_HOURS, LOGO_URL, INSTAGRAM_URL } from './constants';

export function buildWebSiteJsonLd(lang: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: BUSINESS_NAME,
    url: BASE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${BASE_URL}/${lang}?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function buildLocalBusinessJsonLd(lang: string) {
  const dayMap: Record<string, string> = {
    Monday: 'Monday',
    Tuesday: 'Tuesday',
    Wednesday: 'Wednesday',
    Thursday: 'Thursday',
    Friday: 'Friday',
    Saturday: 'Saturday',
    Sunday: 'Sunday',
  };

  const openingSpecs: Record<string, unknown>[] = OPENING_HOURS.flatMap(({ days, opens, closes }) =>
    days.map((day) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: dayMap[day] ?? day,
      opens,
      closes,
    }))
  );

  openingSpecs.push({
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: 'Friday',
    opens: '00:00',
    closes: '00:00',
  });

  return {
    '@context': 'https://schema.org',
    '@type': 'HairSalon',
    name: BUSINESS_NAME,
    image: LOGO_URL,
    url: `${BASE_URL}/${lang}`,
    telephone: PHONE,
    priceRange: PRICE_RANGE,
    paymentAccepted: PAYMENT_ACCEPTED,
    address: {
      '@type': 'PostalAddress',
      addressLocality: ADDRESS_LOCALITY,
      addressCountry: ADDRESS_COUNTRY,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: GEO_LATITUDE,
      longitude: GEO_LONGITUDE,
    },
    openingHoursSpecification: openingSpecs,
    areaServed: {
      '@type': 'City',
      name: ADDRESS_LOCALITY,
    },
    sameAs: [INSTAGRAM_URL],
  };
}

export function buildBreadcrumbJsonLd(lang: string, items: Array<{ position: number; name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item) => ({
      '@type': 'ListItem',
      position: item.position,
      name: item.name,
      item: item.url,
    })),
  };
}

interface FaqEntry {
  question: string;
  answer: string;
}

export function buildFaqJsonLd(entries: FaqEntry[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entries
      .filter((e) => e.question.trim() !== '' && e.answer.trim() !== '')
      .map((e) => ({
        '@type': 'Question',
        name: e.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: e.answer,
        },
      })),
  };
}

export function buildServiceJsonLd(params: {
  name: string;
  description?: string;
  price?: number | string;
  priceCurrency?: string;
  lang: string;
}) {
  const { name, description, price, priceCurrency = 'MAD', lang } = params;
  const offer = price !== undefined
    ? {
        '@type': 'Offer' as const,
        price: String(price),
        priceCurrency,
      }
    : undefined;

  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name,
    description: description ?? undefined,
    provider: {
      '@type': 'HairSalon',
      name: BUSINESS_NAME,
      address: {
        '@type': 'PostalAddress',
        addressLocality: ADDRESS_LOCALITY,
        addressCountry: ADDRESS_COUNTRY,
      },
    },
    areaServed: { '@type': 'City', name: ADDRESS_LOCALITY },
    ...(offer ? { offers: offer } : {}),
  };
}
