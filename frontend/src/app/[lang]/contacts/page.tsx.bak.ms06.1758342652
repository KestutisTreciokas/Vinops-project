export default function Contacts({ params }: { params: { lang: 'en' | 'ru' } }) {
  const t = (en: string, ru: string) => (params.lang === 'ru' ? ru : en)

  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'request@vinops.online'
  const tg    = process.env.NEXT_PUBLIC_TELEGRAM || '@keustis'
  const tgUrl = `https://t.me/${tg.replace('@','')}`

  return (
    <section className="grid gap-6">
      <header>
        <h1 className="h1">{t('Contacts', 'Контакты')}</h1>
        <p className="lead mt-2">
          {t('Reach us for removal requests or general questions.',
             'Свяжитесь с нами по вопросам удаления и общим вопросам.')}
        </p>
      </header>

      <div className="card p-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <div className="text-sm text-fg-muted mb-2">{t('Email', 'Email')}</div>
            <a className="btn btn-secondary btn-lg w-full sm:w-auto" href={`mailto:${email}`}>
              {email}
            </a>
            <p className="text-xs text-fg-subtle mt-2">
              {t('We usually respond within 24–48 hours.',
                 'Обычно отвечаем в течение 24–48 часов.')}
            </p>
          </div>

          <div>
            <div className="text-sm text-fg-muted mb-2">Telegram</div>
            <a className="btn btn-secondary btn-lg w-full sm:w-auto" href={tgUrl} target="_blank" rel="noreferrer">
              {tg}
            </a>
            <p className="text-xs text-fg-subtle mt-2">
              {t('Faster for short messages and clarifications.',
                 'Быстрее для коротких сообщений и уточнений.')}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
