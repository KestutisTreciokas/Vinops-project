export default function VinHistory({ lang }: { lang: 'ru'|'en' }) {
  const t = {
    ru: { title:'История продаж', date:'Дата', auction:'Аукцион', lot:'Лот', status:'Статус', price:'Цена' },
    en: { title:'Sales history', date:'Date', auction:'Auction', lot:'Lot', status:'Status', price:'Price' },
  }[lang];

  // Плейсхолдерные записи — для выравнивания верстки
  const rows = [
    { date:'—', auction:'—', lot:'—', status:'—', price:'—' },
  ];

  return (
    <section id="history" className="card">
      <h3 className="text-lg font-semibold mb-3">{t.title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[var(--fg-muted)]">
            <tr className="[&>th]:text-left [&>th]:font-normal [&>th]:py-2">
              <th>{t.date}</th><th>{t.auction}</th><th>{t.lot}</th>
              <th>{t.status}</th><th className="text-right">{t.price}</th>
            </tr>
          </thead>
          <tbody className="[&>tr>td]:py-2 border-t border-[var(--border-muted)]">
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-[var(--border-muted)] last:border-0">
                <td>{r.date}</td><td>{r.auction}</td><td>{r.lot}</td>
                <td>{r.status}</td><td className="text-right">{r.price}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
