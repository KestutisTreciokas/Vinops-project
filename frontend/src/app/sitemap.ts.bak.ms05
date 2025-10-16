// /root/work/vinops.restore/frontend/src/app/sitemap.ts
import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://vinops.online'
  const now = new Date()

  return [
    { url: `${base}/en`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/ru`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/en/cars`, lastModified: now },
    { url: `${base}/ru/cars`, lastModified: now },
    { url: `${base}/en/contacts`, lastModified: now },
    { url: `${base}/ru/contacts`, lastModified: now },
    { url: `${base}/en/terms`, lastModified: now },
    { url: `${base}/ru/terms`, lastModified: now },
  ]
}
