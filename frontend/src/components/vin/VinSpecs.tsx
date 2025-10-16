'use client'

type Spec = { label: string; value: string }
type Props = { items?: Spec[] }

export default function VinSpecs({ items }: Props) {
  const data: Spec[] = items?.length ? items : [
    {label: 'Марка/модель', value: 'Toyota Camry'},
    {label: 'Год', value: '2019'},
    {label: 'Кузов', value: 'Sedan'},
    {label: 'Двигатель', value: '2.5L'},
    {label: 'Трансмиссия', value: 'AT'},
    {label: 'Привод', value: 'FWD'},
  ]

  return (
    <section className="card">
      <h3 className="text-lg font-semibold mb-3">Характеристики</h3>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        {data.map((s, idx) => (
          <div key={idx} className="flex justify-between gap-4">
            <dt className="text-[var(--fg-muted)]">{s.label}</dt>
            <dd className="text-[var(--fg-default)] font-medium">{s.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
