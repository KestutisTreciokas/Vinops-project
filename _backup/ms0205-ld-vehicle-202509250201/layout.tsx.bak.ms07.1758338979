import sample from '@/mock/vin-sample'

export default function VinLayout({
  params,
  children,
}: {
  params: { lang: 'en' | 'ru'; vin: string }
  children: React.ReactNode
}) {
  const { lang, vin } = params
  const v = sample?.specs || {}
  const base = [v.year, v.make, v.model].filter(Boolean).join(' ')
  const suffix = (v as any).trim || v.body
  const title = suffix ? `${base}, ${suffix}` : base
  const t = (en: string, ru: string) => (lang === 'ru' ? ru : en)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="h1 m-0 flex-1" data-vin-title>{title}</h1>
        <span className="vin-chip inline-flex items-center gap-1 rounded border border-border-muted px-2 py-1 text-xs">
          {t('VIN', 'VIN')}: <code className="font-mono">{vin}</code>
        </span>
      </div>
      {children}
    </div>
  )
}
