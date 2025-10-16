import { VIN_SITEMAP } from '@/data/vin-sitemap'
const BASE = 'https://vinops.online'
export async function GET() {
  const lastmod = new Date().toISOString()
  const rows = VIN_SITEMAP.en.slice(0, 1000).map(v =>
    `<url><loc>${BASE}/en/vin/${v}</loc><lastmod>${lastmod}</lastmod></url>`
  ).join('')
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${rows}</urlset>`
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-store' }})
}
