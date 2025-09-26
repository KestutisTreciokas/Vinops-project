import { NextResponse, type NextRequest } from 'next/server';

function isComplexCars(url: URL): boolean {
  const keys = ['make','model','year_from','year_to','status','damage','title_brand','runs_drives','has_keys','sort'];
  let active = 0;
  for (const k of keys) if (url.searchParams.has(k)) active++;
  return active > 2 || url.searchParams.has('cursor');
}

export function middleware(req: NextRequest) {
  const url = new URL(req.url);
  const path = url.pathname;

  // 410 suppress (демо-путь для приёмки)
  if (/^\/(en|ru)\/vin\/ZZZSUPPRESSZZZ$/.test(path)) {
    const gone = new NextResponse('Suppressed', { status: 410 });
    gone.headers.set('X-Robots-Tag', 'noindex, follow');
    return gone;
  }

  // noindex для сложных запросов каталога
  if (/^\/(en|ru)\/cars/.test(path)) {
    const res = NextResponse.next();
    if (isComplexCars(url)) res.headers.set('X-Robots-Tag', 'noindex, follow');
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/en/:path*','/ru/:path*'],
};
