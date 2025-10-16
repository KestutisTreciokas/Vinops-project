import Gallery from '@/components/vin/Gallery'
import SpecsList from '@/components/vin/SpecsList'
import SalesHistory from '@/components/vin/SalesHistory'

export default function VinDetailsPage({ params }: { params: { lang: 'en'|'ru', vin: string } }) {
  const t = (ru:string,en:string)=> params.lang==='ru'?ru:en

  // TODO: заменить на реальные данные из API
  const images = [
    'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1542362567-b07e54358753?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1549921296-3ecf9a45a08f?q=80&w=1200&auto=format&fit=crop',
  ]

  const carItems = [
    { k: t('Год', 'Year'), v: 2019 },
    { k: t('Марка', 'Make'), v: 'Toyota' },
    { k: t('Модель', 'Model'), v: 'Camry' },
    { k: t('Кузов', 'Body'), v: 'Sedan' },
    { k: t('Топливо', 'Fuel'), v: 'Gasoline' },
    { k: t('Трансмиссия', 'Transmission'), v: 'Automatic' },
  ]

  const lotItems = [
    { k: t('Номер лота', 'Lot number'), v: '80103945' },
    { k: t('Аукцион', 'Auction'), v: 'Copart' },
    { k: t('Продавец', 'Seller'), v: 'Progressive Casualty Insurance' },
    { k: t('Дата', 'Date'), v: '2025-05-12' },
    { k: t('Пробег', 'Odometer'), v: '49 792 mi' },
    { k: t('Статус', 'Status'), v: t('Продан', 'Sold') },
    { k: t('Окончательная ставка', 'Final bid'), v: '$11,500' },
  ]

  const rows = [
    { date:'2025-05-12', price:'$11,500', status:t('Продан','Sold'), auction:'Copart', lot:'80103945' },
    { date:'2024-10-03', price:'$10,200', status:t('Продан','Sold'), auction:'IAAI', lot:'7345021' },
  ]

  return (
    <main data-page="vin-details" className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 text-[var(--fg-muted)]">
        <a href={`/${params.lang}/vin/${params.vin}`} className="underline decoration-[var(--border-muted)] hover:text-[var(--fg-default)]">
          {t('← Назад к карточке', '← Back')}
        </a>
      </div>

      <div className="grid gap-6 md:grid-cols-5">
        <div className="md:col-span-3">
          <Gallery images={images} alt={`VIN ${params.vin}`} />
        </div>
        <div className="md:col-span-2 flex flex-col gap-4">
          <SpecsList title={t('Детали автомобиля','Vehicle details')} items={carItems}/>
          <SpecsList title={t('Информация о лоте','Lot information')} items={lotItems}/>
        </div>
      </div>

      <div className="mt-6">
        <SalesHistory title={t('История продаж','Sales history')} rows={rows}/>
      </div>
    </main>
  )
}
