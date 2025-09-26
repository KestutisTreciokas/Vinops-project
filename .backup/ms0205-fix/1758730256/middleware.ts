import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  // Жёстко пропускаем весь API без модификаций
  if (pathname.startsWith('/api/')) return NextResponse.next()
  return NextResponse.next()
}

// Исключаем /api из матчера, чтобы middleware даже не вызывался для API
export const config = {
  matcher: ['/((?!_next|favicon.ico|robots.txt|sitemap.xml|sitemaps/|api).*)'],
}
