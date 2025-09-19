export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';

import LotInfo from '@/components/vin2/LotInfo';
import Specs from '@/components/vin2/Specs';
import History from '@/components/vin2/History';
import VinGallery from '@/components/vin2/Gallery';
import sample from '@/mock/vin-sample';

// META
export async function generateMetadata(
  { params }: { params: { lang: string; vin: string } }
): Promise<Metadata> {
  const lang = (params.lang || 'en').toLowerCase();
  const vin  = (params.vin  || '').toUpperCase();
  const base = 'https://vinops.online';

  return {
    title: `VIN ${vin} — vinops`,
    description: lang === 'ru'
      ? `Карточка VIN ${vin} с фото и аукционной историей`
      : `VIN ${vin} page with photos and auction history`,
    alternates: {
      canonical: `${base}/${lang}/vin/${vin}`,
      languages: {
        en: `${base}/en/vin/${vin}`,
        ru: `${base}/ru/vin/${vin}`,
        'x-default': `${base}/en/vin/${vin}`,
      },
    },
    openGraph: {
      url: `${base}/${lang}/vin/${vin}`,
      title: `VIN ${vin} — vinops`,
      description: lang === 'ru'
        ? `Карточка VIN ${vin} с фото и аукционной историей`
        : `VIN ${vin} page with photos and auction history`,
    },
  };
}

export default function VinPage({ params }: { params: { lang: 'ru' | 'en'; vin: string } }) {
  const { lang, vin } = params;
  const data = sample; // TODO: заменить на реальные данные
  const base = 'https://vinops.online';
  const url  = `${base}/${lang}/vin/${vin}`;

  // Подготовка данных для JSON-LD
  const photos = Array.isArray(data?.photos) ? data.photos : [];
  const imageUrls = photos.map((p: any) => p?.url).filter(Boolean);

  const specs = data?.specs ?? {};
  const lot   = data?.lot ?? {};
  const history = Array.isArray(data?.history) ? data.history : [];

  const vehicleLd: any = {
    '@context': 'https://schema.org',
    '@type': 'Vehicle',
    name: `VIN ${vin}`,
    url,
    vehicleIdentificationNumber: vin,
    // Обогащение справочными полями (добавляем только если есть значение)
    ...(specs.make && { brand: specs.make }),
    ...(specs.model && { model: specs.model }),
    ...(specs.year && { vehicleModelDate: specs.year }),
    ...(specs.body && { bodyType: specs.body }),
    ...(specs.engine && {
      vehicleEngine: { '@type': 'EngineSpecification', name: specs.engine },
    }),
    ...(specs.transmission && { vehicleTransmission: specs.transmission }),
    ...(specs.drive && { driveWheelConfiguration: specs.drive }),
    ...(lot.odometer && {
      mileageFromOdometer: {
        '@type': 'QuantitativeValue',
        value: lot.odometer,
        unitCode: 'SMI', // miles
      },
    }),
    ...(imageUrls.length && { image: imageUrls }),
    ...(lot.finalBid && {
      offers: {
        '@type': 'Offer',
        price: lot.finalBid,
        priceCurrency: 'USD',
        availability:
          String(lot.status || '')
            .toLowerCase()
            .includes('sold')
            ? 'https://schema.org/SoldOut'
            : 'https://schema.org/InStock',
        ...(lot.seller && { seller: { '@type': 'Organization', name: String(lot.seller) } }),
        url,
      },
    }),
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${base}/${lang}` },
      { '@type': 'ListItem', position: 2, name: `VIN ${vin}`, item: url },
    ],
  };

  const historyLd =
    history.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          itemListElement: history.map((h: any, i: number) => ({
            '@type': 'ListItem',
            position: i + 1,
            item: {
              '@type': 'Offer',
              price: h?.price,
              priceCurrency: 'USD',
              availability: String(h?.status || '').toLowerCase().includes('sold')
                ? 'https://schema.org/SoldOut'
                : 'https://schema.org/InStock',
              url,
            },
          })),
        }
      : null;

  const ldPayload = historyLd ? [vehicleLd, breadcrumbLd, historyLd] : [vehicleLd, breadcrumbLd];

  return (
    <div className="container mx-auto px-4">
      {/* JSON-LD (SSR) */}
      <script
        id="ld-vehicle"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ldPayload) }}
      />

      <h1 className="h1 mb-2">VIN: {vin}</h1>
      <p className="lead mb-6">
        {lang === 'ru'
          ? 'Актуальная информация по лоту: фото, характеристики и история.'
          : 'Up-to-date lot info: photos, specs, and sales history.'}
      </p>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Левая колонка: галерея */}
        <div className="lg:col-span-7">
          <VinGallery photos={photos} />
        </div>

        {/* Правая колонка: характеристики и инфо по лоту */}
        <div className="lg:col-span-5 space-y-6">
          <Specs specs={specs} />
          <LotInfo lot={lot} history={history} lang={lang} />
        </div>

        {/* История продаж на всю ширину */}
        <div className="lg:col-span-12">
          <History lang={lang} rows={history} />
        </div>
      </div>
    </div>
  );
}
