const BASE = 'https://vinops.online'
const lastmod = new Date().toISOString()
const URLS = [
  `${BASE}/en`, `${BASE}/ru`,
  `${BASE}/en/cars`, `${BASE}/ru/cars`,
  `${BASE}/en/contacts`, `${BASE}/ru/contacts`,
  `${BASE}/en/terms`, `${BASE}/ru/terms`,
]

export async function GET() {
  const urls = URLS.map(u => `<url><loc>${u}</loc><lastmod>${lastmod}</lastmod></url>`).join('')
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-store' }})
}
