// /root/work/vinops.restore/frontend/src/components/SearchHero.tsx
'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'

type Lang = 'en' | 'ru'

export default function SearchHero({ lang }: { lang: Lang }) {
  const t = (en: string, ru: string) => (lang === 'ru' ? ru : en)
  const router = useRouter()
  const [vin, setVin] = useState('')

  const normalized = useMemo(() => vin.toUpperCase().replace(/[^A-Z0-9]/g, ''), [vin])
  const isReady = normalized.length === 17

  const go = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault()
      if (!isReady) return
      router.push(`/${lang}/vin/${normalized}`)
    },
    [isReady, normalized, router, lang],
  )

  return (
    <div className="py-8 md:py-10">
      <h1 className="h1">{t('Search by VIN', 'Поиск по VIN')}</h1>
      <p className="lead mt-2 text-fg-muted">
        {t(
          'Enter a 17-character VIN to view photos and auction history.',
          'Введите 17-значный VIN, чтобы посмотреть фото и историю аукционов.',
        )}
      </p>

      <form onSubmit={go} className="mt-6 md:mt-8">
        <div className="flex gap-3 max-w-3xl">
          <input
            value={vin}
            onChange={(e) => setVin(e.target.value)}
            placeholder={t('Enter VIN', 'Введите VIN')}
            className="input h-12 flex-1 px-4"
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            aria-label={t('VIN number', 'Номер VIN')}
            pattern="[A-Za-z0-9]{1,17}"
            title={t('Use only letters A–Z and digits 0–9', 'Допускаются только буквы A–Z и цифры 0–9')}
          />
          <button type="submit" disabled={!isReady} className="btn btn-primary h-12 px-6" aria-disabled={!isReady}>
            {t('Find', 'Найти')}
          </button>
        </div>

        <div className="mt-2 text-sm text-fg-muted space-y-1">
          <div>
            {t(
              'We accept only letters A–Z and digits 0–9. The input will be normalized automatically.',
              'Допускаются только буквы A–Z и цифры 0–9. Ввод нормализуется автоматически.',
            )}
          </div>
        </div>
      </form>
    </div>
  )
}
