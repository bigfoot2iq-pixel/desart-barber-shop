import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'DESART — Premium Barbershop',
    short_name: 'DESART',
    description: 'Premium barbershop in Agadir. Sharp cuts, sharper style. Book your appointment today.',
    start_url: '/fr',
    display: 'standalone',
    background_color: '#0A0800',
    theme_color: '#C9A84C',
    orientation: 'portrait',
    icons: [
      {
        src: '/favicon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/logo.jpg',
        sizes: '192x192',
        type: 'image/jpeg',
        purpose: 'maskable',
      },
      {
        src: '/logo.jpg',
        sizes: '512x512',
        type: 'image/jpeg',
        purpose: 'maskable',
      },
    ],
  };
}
