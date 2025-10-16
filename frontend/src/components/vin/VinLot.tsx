export default function VinLot({ lang }: { lang: 'ru'|'en' }) {
  const t = {
    ru: {
      title: 'Информация о лоте',
      lot: 'Номер лота', auction: 'Аукцион', seller: 'Продавец',
      date: 'Дата', odo: 'Пробег', status: 'Статус', bid: 'Итоговая ставка',
    },
    en: {
      title: 'Lot information',
      lot: 'Lot number', auction: 'Auction', seller: 'Seller',
      date: 'Date', odo: 'Odometer', status: 'Status', bid: 'Final bid',
    }
  }[lang];

  // Плейсхолдеры – заменим данными API позже
  const data = {
    lot: '—', auction: '—', seller: '—',
    date: '—', odo: '—', status: '—', bid: '—',
  };

  const Row = ({label, value}:{label:string; value:string}) => (
    <div className="flex justify-between gap-4">
      <dt className="text-[var(--fg-muted)]">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );

  return (
    <section id="lot" className="card">
      <h3 className="text-lg font-semibold mb-3">{t.title}</h3>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        <Row label={t.lot}     value={data.lot} />
        <Row label={t.auction} value={data.auction} />
        <Row label={t.seller}  value={data.seller} />
        <Row label={t.date}    value={data.date} />
        <Row label={t.odo}     value={data.odo} />
        <Row label={t.status}  value={data.status} />
        <Row label={t.bid}     value={data.bid} />
      </dl>
    </section>
  );
}
