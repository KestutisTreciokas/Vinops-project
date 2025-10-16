import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_FILE = /\.(.*)$/

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  // пропускаем статику и /api
  if (PUBLIC_FILE.test(pathname) || pathname.startsWith('/api')) return

  // если путь без /en или /ru в начале — отправим на /en
  if (!pathname.startsWith('/en') && !pathname.startsWith('/ru')) {
    const url = req.nextUrl.clone()
    url.pathname = `/en${pathname === '/' ? '' : pathname}`
    return NextResponse.redirect(url)
  }
}
