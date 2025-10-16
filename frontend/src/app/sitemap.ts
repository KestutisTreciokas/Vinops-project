import type { MetadataRoute } from 'next'

const siteUrl = 'https://vinops.online'
const langs = ['en','ru'] as const
const routes = ['', '/cars', '/contacts', '/terms'] as const

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const entries: MetadataRoute.Sitemap = []

  for (const path of routes) {
    for (const lang of langs) {
      const url = `${siteUrl}/${lang}${path}`
      entries.push({
        url,
        lastModified: now,
        changeFrequency: path === '' ? 'weekly' : 'monthly',
        priority: path === '' ? 1 : 0.6,
        alternates: {
          languages: {
            en: `${siteUrl}/en${path}`,
            ru: `${siteUrl}/ru${path}`,
            'x-default': `${siteUrl}/en${path}`,
          },
        },
      })
    }
  }

  return entries
}
