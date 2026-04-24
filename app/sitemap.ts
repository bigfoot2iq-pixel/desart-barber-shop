import type { MetadataRoute } from 'next';
import { i18n } from '@/lib/i18n/config';
import { BASE_URL } from '@/lib/seo/constants';

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of i18n.locales) {
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
  }

  return entries;
}
