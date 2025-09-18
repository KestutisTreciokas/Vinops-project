import type { MetadataRoute } from 'next'
import { getSiteUrl } from '../lib/site'

const STATIC = [
  '/', '/en', '/ru',
  '/en/cars', '/ru/cars',
  '/en/contacts', '/ru/contacts',
  '/en/terms', '/ru/terms',
]

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl()
  const now = new Date().toISOString()
  return STATIC.map((p) => ({
    url: `${base}${p}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: p === '/' ? 1 : 0.7,
  }))
}
