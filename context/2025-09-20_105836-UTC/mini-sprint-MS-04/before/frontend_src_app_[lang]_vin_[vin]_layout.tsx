import sample from '@/mock/vin-sample'
import VinChipCopy from '@/components/VinChipCopy'

export default function VinLayout({
  params,
  children,
}: {
  params: { lang: 'en' | 'ru', vin: string }
  children: React.ReactNode
}) {
  const { lang, vin } = params
  const t = (en: string, ru: string) => (lang === 'ru' ? ru : en)
  const { year, make, model, body } = sample.specs

  return (
    <div className="container mx-auto px-4">
      {/* breadcrumbs */}
      <nav className="mb-2 text-sm text-fg-muted" aria-label="Breadcrumb">
        <ol className="flex items-center gap-2">
          <li><a href={`/${lang}`} className="hover:underline">{t('Home', 'Главная')}</a></li>
          <li aria-hidden="true">/</li>
          <li><span>{t('VIN page', 'Страница VIN')}</span></li>
        </ol>
      </nav>

      {/* Title + VIN chip (copyable) */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <h1 className="h1 m-0 flex-1" data-vin-title="true">
          {year} {make} {model}, {body}
        </h1>
        <VinChipCopy vin={vin} lang={lang} />
      </div>

      {children}
    </div>
  )
}
