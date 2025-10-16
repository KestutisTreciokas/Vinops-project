import { VIN_SITEMAP } from '@/data/vin-sitemap'
const BASE = 'https://vinops.online'

export async function GET() {
  const lastmod = new Date().toISOString()
  const shards: string[] = []
  if (VIN_SITEMAP.en.length > 0) shards.push(`${BASE}/sitemaps/vin/en-0.xml`)
  if (VIN_SITEMAP.ru.length > 0) shards.push(`${BASE}/sitemaps/vin/ru-0.xml`)
  const xml =
`<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${BASE}/sitemaps/static.xml</loc><lastmod>${lastmod}</lastmod></sitemap>
  ${shards.map(loc => `<sitemap><loc>${loc}</loc><lastmod>${lastmod}</lastmod></sitemap>`).join('\n')}
</sitemapindex>`
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-store' }})
}
