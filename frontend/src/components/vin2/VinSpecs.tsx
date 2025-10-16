import React from 'react'

type Lang = 'en' | 'ru'
type Specs = {
  year?: number | string
  make?: string
  model?: string
  body?: string
  engine?: string
  transmission?: string
  drive?: string
}

export default function VinSpecs({ specs = {}, lang }: { specs?: Specs; lang: Lang }) {
  const t = (en: string, ru: string) => (lang === 'ru' ? ru : en)

  const rows: Array<{
    key: keyof Specs
    label: string
    value?: string | number
    icon: React.ReactNode
  }> = [
    {
      key: 'year',
      label: t('Year', 'Год'),
      value: specs.year,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="3" y="4" width="18" height="18" rx="2"></rect>
          <path d="M8 2v4M16 2v4M3 10h18"></path>
        </svg>
      ),
    },
    {
      key: 'make',
      label: t('Make', 'Марка'),
      value: specs.make,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M3 13l2-6a2 2 0 0 1 2-1h10a2 2 0 0 1 2 1l2 6M5 13h14M6 17h.01M18 17h.01" />
        </svg>
      ),
    },
    {
      key: 'model',
      label: t('Model', 'Модель'),
      value: specs.model,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M3 13l2-6a2 2 0 0 1 2-1h10a2 2 0 0 1 2 1l2 6M5 13h14M6 17h.01M18 17h.01" />
        </svg>
      ),
    },
    {
      key: 'body',
      label: t('Body', 'Кузов'),
      value: specs.body,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M3 10h5l2-2h4l2 2h5v6h-4l-2 2H7l-2-2H3zM7 10v8" />
        </svg>
      ),
    },
    {
      key: 'engine',
      label: t('Engine', 'Двигатель'),
      value: specs.engine,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
          <path
            d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1-1.3 2.3-.1-.1a1 1 0 0 0-1.2-.2l-1.2.5a8 8 0 0 1-1.9 1.1l-.2 1.3h-2.6l-.2-1.3a8 8 0 0 1-1.9-1.1l-1.2-.5a1 1 0 0 0-1.2.2l-.1.1-1.3-2.3.1-.1a1 1 0 0 0 .2-1.1l-.5-1.2A8 8 0 0 1 3 12l-1.3-.2V9.2L3 9a8 8 0 0 1 1.1-1.9l.5-1.2a1 1 0 0 0-.2-1.2l-.1-.1L5.6 2.3l.1.1a1 1 0 0 0 1.1.2l1.2-.5A8 8 0 0 1 9 3l.2-1.3h2.6L12 3a8 8 0 0 1 1.9 1.1l1.2.5a1 1 0 0 0 1.1-.2l.1-.1 2.3 1.3-.1.1a1 1 0 0 0-.2 1.2l.5 1.2A8 8 0 0 1 21 12l1.3.2v2.6L21 15a8 8 0 0 1-1.1 1.9l-.5 1.2z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
    {
      key: 'transmission',
      label: t('Transmission', 'Трансмиссия'),
      value: specs.transmission,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M12 1v22M17 5H9a3 3 0 1 0 0 6h6a3 3 0 1 1 0 6H7" />
        </svg>
      ),
    },
    {
      key: 'drive',
      label: t('Drive', 'Привод'),
      value: specs.drive,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M4 12h16M4 12l3-3M4 12l3 3M20 12l-3-3M20 12l-3 3" />
        </svg>
      ),
    },
  ]

  return (
    <section className="card p-4">
      <h3 className="card-title mb-3">{t('Specifications', 'Характеристики')}</h3>
      <div className="space-y-2">
        {rows
          .filter((r) => r.value !== undefined && r.value !== null && r.value !== '')
          .map((r) => (
            <div className="flex items-start gap-3 text-sm" key={r.key}>
              <div className="mt-0.5 h-5 w-5 shrink-0 text-fg-muted">{r.icon}</div>
              <div className="flex-1 grid grid-cols-[120px_1fr] gap-x-2">
                <div className="text-fg-muted">{r.label}</div>
                <div className="text-fg-default">{String(r.value)}</div>
              </div>
            </div>
          ))}
      </div>
    </section>
  )
}
