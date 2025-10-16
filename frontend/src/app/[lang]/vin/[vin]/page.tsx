import type { Metadata } from 'next'
import LotInfo from '@/components/vin2/LotInfo'
import VinSpecs from '@/components/vin2/VinSpecs'
import History from '@/components/vin2/History'
import VinGallery from '@/components/vin2/Gallery'
import sample from '@/mock/vin-sample'
import SeoVinJsonLd from './_SeoVinJsonLd'
import VinChipCopy from '@/components/VinChipCopy'

export async function generateMetadata(
  { params }: { params: { lang: 'ru' | 'en', vin: string } }
): Promise<Metadata> {
  const { lang, vin } = params
  const t = (en: string, ru: string) => (lang === 'ru' ? ru : en)

  const path = `/${lang}/vin/${vin}`
  const title = t(`VIN ${vin}`, `VIN ${vin}`)
  const description = t(
    `Vehicle details, photos and sale history for VIN ${vin}.`,
    `Детали автомобиля, фото и история продаж для VIN ${vin}.`
  )

  return {
    metadataBase: new URL('https://vinops.online'),
    title,
    description,
    alternates: {
      canonical: path,
      languages: {
        en: `/en/vin/${vin}`,
        ru: `/ru/vin/${vin}`,
        'x-default': `/en/vin/${vin}`,
      },
    },
    openGraph: {
      url: path,
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

  // --- H1: Year Make Model, Trim | fallback "VIN {vin}"
  const specs: any = (data as any)?.specs || {}
  const titleBase = [specs.year, specs.make, specs.model].filter(Boolean).join(' ')
  const h1Title = titleBase ? `${titleBase}${specs.trim ? `, ${specs.trim}` : ''}` : `VIN ${vin}`

  return (
    <div className="container mx-auto px-4">
      {/* JSON-LD */}
      <SeoVinJsonLd lang={lang} vin={vin} />

      {/* H1 + VIN-chip */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <h1 className="h1">{h1Title}</h1>
        <VinChipCopy vin={vin.toUpperCase()} lang={lang} />
      </div>

      {/* Описание под заголовком */}
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
          <VinSpecs specs={data.specs} lang={lang} />
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
