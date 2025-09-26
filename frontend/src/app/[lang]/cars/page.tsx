import type { Metadata } from 'next';

type Lang = 'en'|'ru';

const API_ORIGIN =
  process.env.INTERNAL_API_ORIGIN
  ?? process.env.NEXT_PUBLIC_BASE_URL
  ?? 'http://127.0.0.1:3000';

type LotCardDto = {
  lotId: string;
  vin: string;
  year?: number;
  make?: string;
  model?: string;
  trim?: string | null;
  image?: { url?: string | null } | null;
};

type SearchResultDto = {
  items: LotCardDto[];
  nextCursor?: string | null;
};

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params, searchParams }: { params: { lang: Lang }, searchParams: Record<string,string|undefined> }): Promise<Metadata> {
  const lang = (params.lang ?? 'en') as Lang;
  const title = lang === 'ru' ? 'Каталог автомобилей' : 'Car catalog';
  const description = lang === 'ru'
    ? 'Каталог активных лотов'
    : 'Catalog of active lots';

  // Каноникал/альтернативы — без изменений семантики
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://vinops.online';
  const path = `/${lang}/cars`;
  const canonical = new URL(path, base).toString();

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        en: new URL('/en/cars', base).toString(),
        ru: new URL('/ru/cars', base).toString(),
        'x-default': new URL('/en/cars', base).toString(),
      },
    },
  };
}

function isComplexFilters(sp: URLSearchParams): boolean {
  // сложные: >2 фильтра или наличие cursor
  const keys = Array.from(sp.keys()).filter(Boolean);
  const kset = new Set(keys);
  if (kset.has('cursor')) return true;
  // белый список простых: make, model, year_from, year_to (до 2 одновременно)
  const simple = ['make','model','year_from','year_to'];
  const nonSimple = keys.filter(k => !simple.includes(k));
  if (nonSimple.length > 0) return true;
  const simpleCount = keys.filter(k => simple.includes(k)).length;
  return simpleCount > 2;
}

async function fetchFirstPage(lang: Lang, searchParams: Record<string,string|undefined>): Promise<SearchResultDto> {
  const sp = new URLSearchParams();
  // переносим whitelisted фильтры (и любые — это read-only API)
  for (const [k,v] of Object.entries(searchParams)) {
    if (typeof v === 'string' && v.length) sp.set(k, v);
  }
  sp.set('limit', '12');
  sp.set('lang', lang);

  const url = `${API_ORIGIN}/api/v1/search?${sp.toString()}`;
  const res = await fetch(url, {
    headers: { 'accept': 'application/json', 'accept-language': lang },
    // для SSR первой страницы достаточно короткого кэша
    next: { revalidate: 30 },
  });
  if (!res.ok) {
    // деградируем без ошибок SSR (пустая выдача, но без моков)
    return { items: [] };
  }
  return await res.json() as SearchResultDto;
}

export default async function Page({ params, searchParams }: { params: { lang: Lang }, searchParams: Record<string,string|undefined> }) {
  const lang = (params.lang ?? 'en') as Lang;
  const sp = new URLSearchParams();
  for (const [k,v] of Object.entries(searchParams)) if (typeof v === 'string') sp.set(k, v);

  // маркер сложных фильтров — meta robots отдаем в <head> как дублирующий сигнал,
  // основной X-Robots-Tag уже ставит middleware.
  const complex = isComplexFilters(sp);

  const data = await fetchFirstPage(lang, searchParams);
  const items = Array.isArray(data.items) ? data.items : [];

  return (
    <main className="container mx-auto px-4 py-4">
      {complex ? <meta name="robots" content="noindex,follow" /> : null}

      <h1 className="h1 mb-4">{lang === 'ru' ? 'Каталог автомобилей' : 'Car catalog'}</h1>

      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-ssr="cars-grid">
        {items.length === 0 && (
          <li className="p-4 border rounded-xl" data-ssr="empty">
            {lang === 'ru' ? 'Нет данных каталога.' : 'No catalog data.'}
          </li>
        )}
        {items.map((it) => {
          const href = `/${lang}/vin/${encodeURIComponent(it.vin)}`;
          const title = [it.year, it.make, it.model, it.trim].filter(Boolean).join(' ');
          return (
            <li key={`${it.lotId}-${it.vin}`} className="p-4 border rounded-xl">
              <a href={href} className="block font-semibold underline" data-ssr-vin-link>
                {title || it.vin}
              </a>
              <div className="text-sm text-muted-foreground">{it.vin}</div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
