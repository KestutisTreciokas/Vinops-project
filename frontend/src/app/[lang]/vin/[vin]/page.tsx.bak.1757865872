import SeoBlock from './_SeoBlock'
import AsideSummary from '@/components/vin/AsideSummary'
import SpecList from '@/components/vin/SpecList'
import Gallery from '@/components/vin/Gallery'

type PageProps = { params: { lang: 'en'|'ru', vin: string } }

export default async function VinPage({ params }: PageProps) {
  const { lang, vin } = params

  // TODO: заменить мок на реальные данные из API
  const mock = {
    title: '2019 Toyota Camry',
    priceUSD: 8900,
    status: 'sold' as const,
    images: [
      '/placeholders/car-1.svg',
      '/placeholders/car-2.svg',
      '/placeholders/car-3.svg',
      '/placeholders/car-4.svg',
      '/placeholders/car-5.svg',
    ],
    specs: [
      { label: lang === 'ru' ? 'Кузов' : 'Body', value: 'Sedan' },
      { label: lang === 'ru' ? 'Двигатель' : 'Engine', value: '2.5L' },
      { label: 'Transmission', value: 'Automatic' },
      { label: 'Location', value: 'Dallas, TX' },
      { label: 'Odometer', value: '45,231 mi' },
      { label: 'Title', value: 'Salvage' },
    ],
  }

  return (
    <div data-page="vin" className="container mx-auto px-4">
      {/* Хлебные крошки */}
      <nav className="text-sm text-fg-muted mb-4">
        <a href={`/${lang}/cars`} className="hover:underline">{lang === 'ru' ? 'Каталог' : 'Catalog'}</a>
        <span className="mx-2">/</span>
        <span className="text-fg-default">{mock.title}</span>
      </nav>

      {/* Заголовок */}
      <header className="mb-6">
        <h1 className="h1">{mock.title}</h1>
        <div className="text-fg-muted">{lang === 'ru' ? 'Отчет по VIN и история' : 'VIN report & history'}</div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Левый столбец */}
        <main className="lg:col-span-8 space-y-6">
          <Gallery images={mock.images} />

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">{lang === 'ru' ? 'Характеристики' : 'Specifications'}</h2>
            <SpecList rows={mock.specs} />
          </section>

          <SeoBlock lang={lang} />
        </main>

        {/* Правый столбец */}
        <div className="lg:col-span-4">
          <AsideSummary
            vin={vin}
            priceUSD={mock.priceUSD}
            status={mock.status}
            ctaHref={`/${lang}/contacts`}
          />
        </div>
      </div>
    </div>
  )
}
