'use client'
import Features from './_home/Features'
import { useState } from 'react'
import Script from 'next/script'

export default function Home({ params }: { params: { lang: 'en' | 'ru' } }) {
  const { lang } = params as { lang: "en" | "ru" };
  const [vin, setVin] = useState('')
  const t = (en: string, ru: string) => (lang === 'ru' ? ru : en)

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const normalized = vin.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
    if (normalized.length !== 17) {
      alert(t('VIN must be 17 characters', 'VIN должен быть 17 символов'))
      return
    }
    window.location.href = `/${lang}/vin/${normalized}`
  }

  // JSON-LD SearchAction для Sitelinks Search Box
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    url: 'https://vinops.online',
    potentialAction: {
      '@type': 'SearchAction',
      target: `https://vinops.online/${lang}/vin/{search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }

  return (
    <>
      <Script id="ld-search" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <section className="py-16">
        <h1 className="h1 mb-4">
          {t('Search by VIN', 'Поиск по VIN')}
        </h1>
        <p className="lead mb-6">
          {t(
            'Enter a 17-character VIN to view photos and auction history.',
            'Введите 17-значный VIN, чтобы увидеть фото и историю продаж.'
          )}
        </p>

        <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-3 max-w-2xl">
          <label htmlFor="vin" className="sr-only">VIN</label>
          <input
            id="vin"
            value={vin}
            onChange={(e) => setVin(e.target.value)}
            placeholder={t('Enter VIN', 'Введите VIN')}
            className="input input-lg"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            aria-label={t('VIN', 'VIN')}
            maxLength={23} /* позволяем вставить с пробелами/дефисами, очищаем сами */
          />
          <button type="submit" className="btn btn-primary btn-lg">
            {t('Find', 'Найти')}
          </button>
        </form>

        <p className="text-xs text-fg-subtle mt-2">
          {t('We accept only letters A–Z and digits 0–9. The input will be normalized automatically.',
             'Допустимы только буквы A–Z и цифры 0–9. Ввод будет автоматически нормализован.')}
        </p>
      </section>
      <Features lang={lang} />
    </>
  )
}
