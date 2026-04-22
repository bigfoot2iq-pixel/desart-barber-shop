import type { MetadataRoute } from 'next';
import { i18n } from '@/lib/i18n/config';

const BASE_URL = 'https://www.desart.ma';

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of i18n.locales) {
    // Homepage — highest priority
    entries.push({
      url: `${BASE_URL}/${locale}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
      alternates: {
        languages: Object.fromEntries(
          i18n.locales.map((l) => [l, `${BASE_URL}/${l}`])
        ),
      },
    });

    // Services page
    entries.push({
      url: `${BASE_URL}/${locale}/services`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
      alternates: {
        languages: Object.fromEntries(
          i18n.locales.map((l) => [l, `${BASE_URL}/${l}/services`])
        ),
      },
    });

    // Home visit page
    entries.push({
      url: `${BASE_URL}/${locale}/a-domicile`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
      alternates: {
        languages: Object.fromEntries(
          i18n.locales.map((l) => [l, `${BASE_URL}/${l}/a-domicile`])
        ),
      },
    });

    // Login page
    entries.push({
      url: `${BASE_URL}/${locale}/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    });

    // Dashboard (protected, but still indexable for branded searches)
    entries.push({
      url: `${BASE_URL}/${locale}/dashboard`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.2,
    });
  }

  return entries;
}
