import { NextRequest, NextResponse } from 'next/server';
import { isVinValid } from './src/app/_lib/vin'; // поправьте путь, если _lib лежит в src/app/_lib

/** VIN validation — strict per SSOT */
function normalizeVin(input: string): string { return (input||'').trim().toUpperCase(); }
function isVinValid(input: string): boolean {
  const v = normalizeVin(input);
  if (v.length < 11 || v.length > 17) return false;
  if (!/^[A-Z0-9]+$/.test(v)) return false;
  if (v.length === 17 && /[IOQ]/.test(v)) return false;
  return true;
}

export const config = {
  matcher: ['/((en|ru))/vin/:vin*', '/((en|ru))/cars'],
};

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const parts = url.pathname.split('/').filter(Boolean); // [lang, 'vin'|'cars', ...]
  const lang = (parts[0] === 'ru' ? 'ru' : 'en') as 'en'|'ru';

  // VIN route
  if (parts.length >= 3 && parts[1] === 'vin') {
    const vin = normalizeVin(parts[2] || '');
    // 422->404: невалидный VIN
    if (!isVinValid(vin)) {
      const res = new NextResponse(null, { status: 404 });
      res.headers.set('X-Robots-Tag', 'noindex, follow');
      return res;
    }
    // suppress → 410: быстрый проб через локальный API (без кэша)
    try {
      const api = new URL(`/api/v1/vehicles/${vin}`, url);
      const r = await fetch(api, {
        method: 'GET',
        headers: { 'Accept-Language': lang, 'X-MW-Probe': '1' },
        cache: 'no-store',
      });
      if (r.status === 410) {
        const res = new NextResponse(null, { status: 410 });
        res.headers.set('X-Robots-Tag', 'noindex, follow');
        return res;
      }
      if (r.status === 422) {
        const res = new NextResponse(null, { status: 404 });
        res.headers.set('X-Robots-Tag', 'noindex, follow');
        return res;
      }
    } catch {
      // пасс-тру при недоступности API
    }
    return NextResponse.next();
  }

  // Cars route: complex filters => noindex,follow
  if (parts.length >= 2 && parts[1] === 'cars') {
    const sp = url.searchParams;
    const keys = ['make','model','year_from','year_to','status','damage','title_brand','runs_drives','has_keys','sort','cursor'];
    const active = keys.filter(k => sp.has(k) && (sp.get(k) ?? '') !== '');
    const onlySimple = active.every(k => ['make','model','year_from','year_to'].includes(k));
    const isComplex = sp.has('cursor') || (active.length > 2 && !(onlySimple && active.length <= 2));
    if (isComplex) {
      const res = NextResponse.next();
      res.headers.set('X-Robots-Tag', 'noindex, follow');
      return res;
    }
  }

  return NextResponse.next();
}
