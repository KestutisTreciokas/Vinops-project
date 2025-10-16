import LotInfo from '@/components/vin2/LotInfo'
import Specs from '@/components/vin2/Specs'
import History from '@/components/vin2/History'
import VinGallery from '@/components/vin2/Gallery'
import sample from '@/mock/vin-sample'

export default function VinPage({ params }: { params: { lang: 'ru'|'en', vin: string } }) {
  const { lang, vin } = params
  const t = (en: string, ru: string) => (lang === 'ru' ? ru : en)
  const data = sample

  return (
    <div className="container mx-auto px-4">
      <h1 className="h1 mb-2">VIN: {vin}</h1>
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
