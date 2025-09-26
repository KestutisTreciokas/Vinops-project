import type { Metadata } from 'next';

const ORIGIN = process.env.PUBLIC_SITE_ORIGIN ?? 'https://vinops.online';

function isComplex(sp: URLSearchParams): boolean {
  const allow = new Set(['make','model','year_from','year_to']);
  let active = 0;
  sp.forEach((v,k) => { if ((v ?? '').trim() !== '' && allow.has(k)) active++; });
  return active > 2 || (Array.from(sp.keys()).some(k => !allow.has(k)) ) || sp.has('cursor');
}

export async function generateMetadata({ params, searchParams }: any): Promise<Metadata> {
  const lang = params.lang as 'en'|'ru';
  const robots = isComplex(new URLSearchParams(Object.entries(searchParams ?? {})))
    ? { index: false, follow: true }
    : { index: true, follow: true };
  return {
    title: lang === 'ru' ? 'Каталог' : 'Catalog',
    description: lang === 'ru' ? 'Каталог лотов' : 'Lots catalog',
    robots,
    alternates: { canonical: `${ORIGIN}/${lang}/cars` }
  };
}

export default function Page() {
  return (
    <main className="container mx-auto px-4 py-6">
      <h1 className="h1">Catalog</h1>
      {/* SSR списка/фрагмента подключается в MS-02-03; здесь не регрессируем head */}
    </main>
  );
}
