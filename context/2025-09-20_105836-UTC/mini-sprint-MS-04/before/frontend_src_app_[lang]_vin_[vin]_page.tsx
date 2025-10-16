import type { Metadata, ResolvingMetadata } from 'next'
import LotInfo from '@/components/vin2/LotInfo'
import Specs from '@/components/vin2/Specs'
import History from '@/components/vin2/History'
import VinGallery from '@/components/vin2/Gallery'
import sample from '@/mock/vin-sample'
import SeoVinJsonLd from './_SeoVinJsonLd'

const BASE_URL = 'https://vinops.online'

export async function generateMetadata(
  { params }: { params: { lang: 'ru' | 'en', vin: string } },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { lang, vin } = params
  const t = (en: string, ru: string) => (lang === 'ru' ? ru : en)

  const path = `/${lang}/vin/${vin}`
  const canonical = `${BASE_URL}${path}`
  const title = t(`VIN ${vin}`, `VIN ${vin}`)
  const description = t(
    `Vehicle details, photos and sale history for VIN ${vin}.`,
    `Детали автомобиля, фото и история продаж для VIN ${vin}.`
  )

  return {
    title, // layout will apply template "%s — vinops"
    description,
    alternates: {
      canonical,
      languages: {
        en: `${BASE_URL}/en/vin/${vin}`,
        ru: `${BASE_URL}/ru/vin/${vin}`,
        'x-default': `${BASE_URL}/en/vin/${vin}`,
      },
    },
    openGraph: {
      url: canonical,
      title: `${title} — vinops`,
      description,
      type: 'website',
    },
    robots: { index: true, follow: true },
  }
}

export default function VinPage({ params }: { params: { lang: 'ru'|'en', vin: string } }) {
  const { lang, vin } = params
  const data = sample
  const t = (en: string, ru: string) => (lang === 'ru' ? ru : en)

  return (
    <div className="container mx-auto px-4">
      {/* JSON-LD */}
      <SeoVinJsonLd lang={lang} vin={vin} />

      {/* Описание под заголовком из layout */}
      <p className="lead mb-6">
        {lang === 'ru'
          ? 'Актуальная информация по лоту, фото, характеристики и история.'
          : 'Up-to-date lot info: photos, specs, and sales history.'}
      </p>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Левая колонка: галерея */}
        <div className="lg:col-span-7">
          <VinGallery photos={data.photos ?? []} />
        </div>

        {/* Правая колонка: характеристики и инфо по лоту */}
        <div className="lg:col-span-5 space-y-6">
          <Specs specs={data.specs} />
          <LotInfo lot={data.lot} history={data.history} lang={lang} />
        </div>

        {/* Ниже — история продаж на всю ширину */}
        <div className="lg:col-span-12">
          <History lang={lang} rows={data.history || []} />
        </div>
      </div>
    </div>
  )
}
