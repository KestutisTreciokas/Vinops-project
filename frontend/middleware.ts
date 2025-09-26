import { NextRequest, NextResponse } from 'next/server'

function normalizeVin(input: string): string {
  return (input || '').trim().toUpperCase()
}
function isVinValid(input: string): boolean {
  const v = normalizeVin(input)
  if (v.length < 11 || v.length > 17) return false
  if (!/^[A-Z0-9]+$/.test(v)) return false
  if (v.length === 17 && /[IOQ]/.test(v)) return false
  return true
}

export const config = {
  matcher: [
    '/en/vin/:vin*',
    '/ru/vin/:vin*',
    '/en/cars',
    '/ru/cars',
  ],
}

export async function middleware(req: NextRequest) {
  const url = req.nextUrl
  const parts = url.pathname.split('/').filter(Boolean) // [lang, 'vin'|'cars', ...]
  const lang = (parts[0] === 'ru' ? 'ru' : 'en') as 'en'|'ru'

  // VIN route guards
  if (parts.length >= 3 && parts[1] === 'vin') {
    const vin = normalizeVin(parts[2] || '')

    // 1) Invalid VIN => 404 + noindex, follow
    if (!isVinValid(vin)) {
      const res = new NextResponse(null, { status: 404 })
      res.headers.set('X-Robots-Tag', 'noindex, follow')
      return res
    }

    // 2) Probe API to map suppressed/invalid/notFound to proper codes + X-Robots-Tag
    try {
      const apiUrl = new URL(`/api/v1/vehicles/${encodeURIComponent(vin)}`, url)
      const r = await fetch(apiUrl, {
        method: 'GET',
        headers: { 'Accept-Language': lang, 'X-MW-Probe': '1' },
        cache: 'no-store',
      })

      // Primary: respect status codes
      if (r.status === 410) {
        const res = new NextResponse(null, { status: 410 })
        res.headers.set('X-Robots-Tag', 'noindex, follow')
        return res
      }
      if (r.status === 422) {
        const res = new NextResponse(null, { status: 404 })
        res.headers.set('X-Robots-Tag', 'noindex, follow')
        return res
      }
      if (r.status === 404) {
        const res = new NextResponse(null, { status: 404 })
        res.headers.set('X-Robots-Tag', 'noindex, follow')
        return res
      }

      // Fallback: inspect JSON flags (__gone/__invalid/__notFound)
      // to enforce 410/404 mapping even if API replied 200
      if (r.ok && (r.headers.get('content-type') || '').includes('application/json')) {
        const j = await r.clone().json().catch(() => undefined) as any
        if (j && j.__gone) {
          const res = new NextResponse(null, { status: 410 })
          res.headers.set('X-Robots-Tag', 'noindex, follow')
          return res
        }
        if (j && (j.__invalid || j.__notFound)) {
          const res = new NextResponse(null, { status: 404 })
          res.headers.set('X-Robots-Tag', 'noindex, follow')
          return res
        }
      }
    } catch {
      // fail-open: let the page handle it via notFound()/robots meta
    }
    return NextResponse.next()
  }

  // Cars route: set X-Robots-Tag for complex filters (noindex,follow)
  if (parts.length >= 2 && parts[1] === 'cars') {
    const sp = url.searchParams
    const keys = ['make','model','year_from','year_to','status','damage','title_brand','runs_drives','has_keys','sort','cursor']
    const active = keys.filter(k => sp.has(k) && (sp.get(k) ?? '') !== '')
    const onlySimple = active.every(k => ['make','model','year_from','year_to'].includes(k))
    const isComplex = sp.has('cursor') || (active.length > 2 && !(onlySimple && active.length <= 2))

    if (isComplex) {
      const res = NextResponse.next()
      res.headers.set('X-Robots-Tag', 'noindex, follow')
      return res
    }
    return NextResponse.next()
  }

  return NextResponse.next()
}
