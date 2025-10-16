'use client'
import SearchIcon from '@/icons/SearchIcon'
import DocIcon from '@/icons/DocIcon'
import HistoryIcon from '@/icons/HistoryIcon'
import ShieldIcon from '@/icons/ShieldIcon'

export default function Features({ lang }: { lang: 'en'|'ru' }) {
  const t = (en: string, ru: string) => (lang === 'ru' ? ru : en)

  const items = [
    {
      icon: <SearchIcon className="w-6 h-6" />,
      title: t('VIN lookup', 'Поиск по VIN'),
      desc: t('Open auction records and current status.', 'Открытые данные аукционов и текущий статус.'),
    },
    {
      icon: <HistoryIcon className="w-6 h-6" />,
      title: t('Sale history', 'История продаж'),
      desc: t('Final bids, dates, mileage changes.', 'Финальные ставки, даты, пробег.'),
    },
    {
      icon: <DocIcon className="w-6 h-6" />,
      title: t('Full specs', 'Полное описание'),
      desc: t('Damage, title, keys, engine, options.', 'Повреждения, документы, ключи, мотор, опции.'),
    },
    {
      icon: <ShieldIcon className="w-6 h-6" />,
      title: t('Privacy control', 'Контроль приватности'),
      desc: t('Removal by request in one click.', 'Удаление по запросу в один клик.'),
    },
  ]

  return (
    <section id="home-features" className="container mt-12">
      <h2 className="text-xl font-semibold mb-6">{t('What you get', 'Что вы получите')}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((it, i) => (
          <div key={i} className="card feature-card border rounded-2xl p-4 bg-bg-surface">
            <div className="flex items-start gap-4">
              <div className="brand-tint text-brand flex items-center justify-center w-10 h-10 rounded-xl shrink-0">
                {it.icon}
              </div>
              <div>
                <div className="font-medium mb-1">{it.title}</div>
                <div className="text-sm text-fg-muted">{it.desc}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
