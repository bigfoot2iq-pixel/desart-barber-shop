import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/auth/', '/_next/', '/*/dashboard', '/*/admin', '/*/professional', '/*/login'],
      },
    ],
    sitemap: 'https://www.desart.shop/sitemap.xml',
  };
}
