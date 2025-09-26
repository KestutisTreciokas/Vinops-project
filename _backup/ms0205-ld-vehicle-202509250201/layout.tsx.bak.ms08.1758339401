import sample from '@/mock/vin-sample'

export default function VinLayout({
  params,
  children,
}: {
  params: { lang: 'en' | 'ru'; vin: string }
  children: React.ReactNode
}) {
  const { lang, vin } = params
  const t = (en: string, ru: string) => (lang === 'ru' ? ru : en)

  // Моки до интеграции API
  const { specs } = sample
  const title = [specs.year, specs.make, specs.model, specs.body ? `${specs.body}` : '']
    .filter(Boolean)
    .join(' ')
    .replace(' Sedan', ', Sedan') // лёгкий косметический штрих для примера

  return (
    <div>
      <div className="container mx-auto px-4">
        {/* Breadcrumbs (UI) */}
        <nav className="mb-2 text-sm text-fg-muted" aria-label="Breadcrumb">
          <ol className="flex items-center gap-2">
            <li>
              <a href={`/${lang}`} className="hover:underline">{t('Home', 'Главная')}</a>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <span>{t('VIN page', 'Страница VIN')}</span>
            </li>
          </ol>
        </nav>

        {/* Заголовок + VIN chip */}
        <div className="flex items-center gap-3 mb-4">
          <h1 className="h1 m-0 flex-1" data-vin-title="true">{title}</h1>
          <span
            className="vin-chip inline-flex items-center gap-1 rounded border border-border-muted px-2 py-1 text-xs"
            data-vin-chip="true"
          >
            <span>VIN:</span>
            <code className="font-mono" data-vin-value={vin}>{vin}</code>
            {/* Специально без JS, только атрибуты для QA/а11y */}
            <button
              type="button"
              className="copy-btn inline-flex items-center gap-1 rounded-md px-2 h-7 text-xs border border-[var(--border-muted)]"
              title={t('Copy VIN', 'Скопировать VIN')}
              aria-label={t('Copy VIN', 'Скопировать VIN')}
              data-vin-copy={vin}
            >
              ⧉
            </button>
          </span>
        </div>
      </div>

      {children}
    </div>
  )
}
