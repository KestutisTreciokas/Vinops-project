import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import LotInfo from '@/components/vin2/LotInfo'
import VinSpecs from '@/components/vin2/VinSpecs'
import History from '@/components/vin2/History'
import VinGallery from '@/components/vin2/Gallery'
import AuctionHistoryTimeline from '@/components/vin2/AuctionHistoryTimeline'
import SeoVinJsonLd from './_SeoVinJsonLd'
import VinChipCopy from '@/components/VinChipCopy'
import { fetchVehicleDetails, transformVehicleData } from './_api'

export async function generateMetadata(
  { params }: { params: { lang: 'ru' | 'en', vin: string } }
): Promise<Metadata> {
  const { lang, vin } = params
  const vinUpper = vin.toUpperCase()
  const t = (en: string, ru: string) => (lang === 'ru' ? ru : en)

  // Fetch vehicle data for rich metadata
  const vehicleData = await fetchVehicleDetails(vinUpper, lang)

  const path = `/${lang}/vin/${vinUpper}`

  // Rich title with vehicle info if available
  let title = `VIN ${vinUpper}`
  let description = t(
    `Vehicle details, photos and sale history for VIN ${vinUpper}.`,
    `Детали автомобиля, фото и история продаж для VIN ${vinUpper}.`
  )

  if (vehicleData) {
    const { year, make, model } = vehicleData
    const vehicleName = [year, make, model].filter(Boolean).join(' ')
    if (vehicleName) {
      title = `${vehicleName} — VIN ${vinUpper}`
      description = t(
        `${vehicleName} with VIN ${vinUpper}. View photos, specifications, auction details and sale history.`,
        `${vehicleName} с VIN ${vinUpper}. Смотрите фото, характеристики, детали аукциона и историю продаж.`
      )
    }
  }

  return {
    metadataBase: new URL('https://vinops.online'),
    title,
    description,
    alternates: {
      canonical: path,
      languages: {
        en: `/en/vin/${vinUpper}`,
        ru: `/ru/vin/${vinUpper}`,
        'x-default': `/en/vin/${vinUpper}`,
      },
    },
    openGraph: {
      url: path,
      title: `${title} — vinops`,
      description,
      type: 'website',
      ...(vehicleData?.currentLot?.primaryImageUrl && {
        images: [
          {
            url: vehicleData.currentLot.primaryImageUrl,
            width: 1200,
            height: 630,
            alt: title,
          },
        ],
      }),
    },
    robots: { index: true, follow: true },
  }
}

export default async function VinPage({ params }: { params: { lang: 'ru'|'en', vin: string } }) {
  const { lang, vin } = params
  const vinUpper = vin.toUpperCase()
  const t = (en: string, ru: string) => (lang === 'ru' ? ru : en)

  // Fetch vehicle data from API
  const vehicleData = await fetchVehicleDetails(vinUpper, lang)

  // If VIN not found, return 404
  if (!vehicleData) {
    notFound()
  }

  // Transform API data to component format
  const data = transformVehicleData(vehicleData)

  // --- H1: Year Make Model, Trim | fallback "VIN {vin}"
  const specs = data.specs || {}
  const titleBase = [specs.year, specs.make, specs.model].filter(Boolean).join(' ')
  const h1Title = titleBase ? `${titleBase}${specs.trim ? `, ${specs.trim}` : ''}` : `VIN ${vinUpper}`

  return (
    <div className="container mx-auto px-4">
      {/* JSON-LD */}
      <SeoVinJsonLd lang={lang} vin={vinUpper} vehicleData={vehicleData} />

      {/* H1 + VIN-chip */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <h1 className="h1">{h1Title}</h1>
        <VinChipCopy vin={vinUpper} lang={lang} />
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

        {/* Auction History Timeline (CSV-only outcome detection) */}
        {data.lot && (
          <div className="lg:col-span-12">
            <AuctionHistoryTimeline
              currentAttempt={{
                lotId: data.lot.lotId,
                outcome: vehicleData.currentLot?.outcome,
                outcomeConfidence: vehicleData.currentLot?.outcomeConfidence,
                outcomeDate: vehicleData.currentLot?.outcomeDate,
                auctionDateTimeUtc: data.lot.auctionDate,
                currentBidUsd: vehicleData.currentLot?.currentBidUsd,
                finalBidUsd: vehicleData.currentLot?.finalBidUsd,
                siteCode: data.lot.siteCode,
                city: data.lot.location
              }}
              relistCount={vehicleData.currentLot?.relistCount}
              lang={lang}
            />
          </div>
        )}

        {/* Ниже — история продаж на всю ширину */}
        <div className="lg:col-span-12">
          <History lang={lang} rows={data.history || []} />
        </div>
      </div>
    </div>
  )
}
