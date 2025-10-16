export default function Terms({ params }: { params: { lang: 'en' | 'ru' } }) {
  const t = (en: string, ru: string) => (params.lang === 'ru' ? ru : en)
  return (
    <section className="grid gap-6">
      <header>
        <h1 className="h1">{t('Terms & Conditions', 'Условия использования')}</h1>
        <p className="lead mt-2">
          {t('Placeholder page — content will be added later.',
             'Заглушка — содержимое добавим позже.')}
        </p>
      </header>

      <div className="card p-6">
        <p className="text-sm text-fg-muted">
          {t('If you have questions, please contact us via email or Telegram.',
             'Если есть вопросы — свяжитесь по email или в Telegram.')}
        </p>
      </div>
    </section>
  )
}

// --- MS-06 SEO metadata (canonical + hreflang) ---
export async function generateMetadata({ params } : { params: { lang: 'en'|'ru' } }) {
  const { lang } = params
  const t = (en: string, ru: string) => (lang === 'ru' ? ru : en)
  const BASE = 'https://vinops.online'
  const PATH = '/terms'
  const canonical = `${BASE}/${lang}${PATH}`
  const title = t('Terms of Service', 'Условия сервиса')
  const description = t('Terms and conditions for using vinops.', 'Условия использования сервиса vinops.')

  return {
    // layout применит шаблон "%s — vinops"
    title,
    description,
    alternates: {
      canonical,
      languages: {
        en: `${BASE}/en${PATH}`,
        ru: `${BASE}/ru${PATH}`,
        'x-default': `${BASE}/en${PATH}`,
      },
    },
    openGraph: {
      url: canonical,
      title: `${title} — vinops`,
      description,
      type: 'website',
    },
    robots: { index: true, follow: true },
  }
}
// --- /MS-06 ---
