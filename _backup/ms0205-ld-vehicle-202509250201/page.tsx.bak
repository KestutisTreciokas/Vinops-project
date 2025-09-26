import VinLeftColumn from '@/components/vin/VinLeftColumn'
import VinSidebar from '@/components/vin/VinSidebar'

export default function VinPage({ params }: { params: { lang: 'ru'|'en', vin: string } }) {
  const { lang, vin } = params

  return (
    <div data-page="vin" className="container mx-auto px-4 md:px-6 lg:px-8 py-8">
      {/* Заголовок */}
      <header className="mb-6">
        <h1 className="h1 mb-2">VIN: {vin}</h1>
        <p className="lead">Актуальная информация по лоту, фото и спецификации.</p>
      </header>

      {/* Макет 2 колонки */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Левая колонка */}
        <div className="lg:col-span-8 space-y-6">
          {/* сюда позже добавим: История, Похожие лоты и т.д. */}
        </div>

        {/* Правая колонка (липкая) */}
        <div className="lg:col-span-4">
    <VinLeftColumn lang={params.lang} />
          <VinSidebar />
        </div>
      </div>
    </div>
  )
}
