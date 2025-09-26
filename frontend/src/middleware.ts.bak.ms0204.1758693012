import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_FILE = /\.(.*)$/
// Явные пути без локали, которые НЕ редиректим:
const BYPASS_PATHS = new Set<string>(['/health', '/healthz'])

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Пропускаем статические файлы и /api/*
  if (PUBLIC_FILE.test(pathname) || pathname.startsWith('/api')) return

  // Пропускаем служебные health-эндпоинты без локали
  if (BYPASS_PATHS.has(pathname)) return

  // Если нет префикса локали (/en|/ru) — редиректим на /en…
  if (!pathname.startsWith('/en') && !pathname.startsWith('/ru')) {
    const url = req.nextUrl.clone()
    url.pathname = `/en${pathname === '/' ? '' : pathname}`
    return NextResponse.redirect(url)
  }
}
