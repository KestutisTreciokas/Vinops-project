import { VIN_SITEMAP, SHARD_SIZE } from '@/data/vin-sitemap'

const BASE = 'https://vinops.online'
const langs = ['en','ru'] as const

export async function GET() {
  const urls: string[] = []
  for (const lang of langs) {
    const total = VIN_SITEMAP[lang].length
    const count = Math.max(1, Math.ceil(total / SHARD_SIZE))
    for (let i = 0; i < count; i++) {
      urls.push(`${BASE}/sitemaps/vin/${lang}-${i}.xml`)
    }
  }
  const body = urls.map(u => `<sitemap><loc>${u}</loc></sitemap>`).join('')
  const xml = `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</sitemapindex>`
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-store' }})
}
