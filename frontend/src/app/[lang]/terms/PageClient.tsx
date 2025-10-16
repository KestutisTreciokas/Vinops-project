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

