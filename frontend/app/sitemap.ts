import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://vinops.online';
  const now = new Date();

  const paths = [
    '',             // /
    '/en', '/ru',
    '/en/cars', '/ru/cars',
    '/en/contacts', '/ru/contacts',
    '/en/about', '/ru/about',
    '/en/terms', '/ru/terms'
  ];

  return paths.map((p) => ({
    url: `${base}${p}`,
    lastModified: now,
    changeFrequency: 'daily',
    priority: p === '' ? 1 : 0.7
  }));
}
