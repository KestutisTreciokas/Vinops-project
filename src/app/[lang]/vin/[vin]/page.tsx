import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

const ORIGIN = process.env.PUBLIC_SITE_ORIGIN ?? 'https://vinops.online';

function isVinValid(raw: string): boolean {
  const vin = (raw || '').toUpperCase();
  if (vin.length < 11 || vin.length > 17) return false;
  if (vin.length === 17 && /[IOQ]/.test(vin)) return false;
  return /^[A-Z0-9-]+$/.test(vin);
}

async function fetchVehicle(vin: string) {
  try {
    const r = await fetch(`${ORIGIN}/api/v1/vehicles/${vin}`, { next: { revalidate: 60 } });
    return { status: r.status, data: r.ok ? await r.json() : null };
  } catch {
    return { status: 500 as const, data: null };
  }
}

export async function generateMetadata(
  { params }: { params: { lang: 'en'|'ru', vin: string } }
): Promise<Metadata> {
  const vin = params.vin.toUpperCase();
  const lang = params.lang;
  const canonical = `${ORIGIN}/${lang}/vin/${vin}`;
  const alternates = {
    canonical,
    languages: {
      en: `${ORIGIN}/en/vin/${vin}`,
      ru: `${ORIGIN}/ru/vin/${vin}`,
      'x-default': `${ORIGIN}/en/vin/${vin}`,
    }
  };
  // Важно: здесь без брендов — layout добавит " — vinops" по шаблону
  return {
    title: `VIN ${vin}`,
    description: lang === 'ru' ? 'VIN-страница' : 'VIN page',
    alternates,
  };
}

export default async function Page({ params }: { params: { lang: 'en'|'ru', vin: string } }) {
  const vin = params.vin.toUpperCase();
  if (!isVinValid(vin)) {
    // Политика: 422 -> SSR 404
    notFound();
  }
  const { status, data } = await fetchVehicle(vin);
  if (status === 404) notFound();
  if (status === 410) {
    // Брендированный body отдаёт middleware как 410; здесь — резерв
    return null;
  }

  const v = (data?.vehicle ?? null) as any;
  const year  = v?.year;
  const make  = v?.make;
  const model = v?.model;
  const trim  = v?.trim;

  const jsonLdVehicle: any = {
    '@context':'https://schema.org',
    '@type':'Vehicle',
    vehicleIdentificationNumber: vin,
    url: `${ORIGIN}/${params.lang}/vin/${vin}`,
  };
  if (make)  jsonLdVehicle.brand = { '@type':'Brand', name: String(make) };
  if (model) jsonLdVehicle.model = String(model);
  if (year)  jsonLdVehicle.productionDate = String(year);

  const jsonLdBreadcrumb = {
    '@context':'https://schema.org',
    '@type':'BreadcrumbList',
    itemListElement:[
      { '@type':'ListItem', position:1, name: params.lang === 'ru' ? 'Главная':'Home',  item: `${ORIGIN}/${params.lang}` },
      { '@type':'ListItem', position:2, name: params.lang === 'ru' ? 'Каталог':'Cars', item: `${ORIGIN}/${params.lang}/cars` },
      { '@type':'ListItem', position:3, name: `VIN ${vin}`, item: `${ORIGIN}/${params.lang}/vin/${vin}` }
    ]
  };

  return (
    <main className="container mx-auto px-4 py-6">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h1 className="h1">
          {year ? `${year} ` : ''}{make ? `${make} ` : ''}{model ? `${model}` : `VIN ${vin}`}{trim ? `, ${trim}` : ''}
        </h1>
        <span className="badge">{vin}</span>
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdVehicle) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />

      <section className="mt-4">
        <h2 className="h2">{params.lang === 'ru' ? 'Характеристики' : 'Specifications'}</h2>
        <ul className="mt-2 list-disc pl-5 text-sm">
          {year  && <li>Year: {year}</li>}
          {make  && <li>Make: {make}</li>}
          {model && <li>Model: {model}</li>}
          {trim  && <li>Trim: {trim}</li>}
        </ul>
      </section>
    </main>
  );
}
