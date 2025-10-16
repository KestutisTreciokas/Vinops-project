'use client'
import { useState } from 'react'

type Props = { images?: string[] }

export default function VinGallery({ images }: Props) {
  const demo = images && images.length ? images : Array.from({length: 6}, (_,i)=>`#${i}`)
  const [active, setActive] = useState(0)

  return (
    <section className="card p-0 overflow-hidden">
      <div className="aspect-video bg-[var(--bg-subtle)] flex items-center justify-center">
        {/* В реале сюда придут <img/>; пока — заглушка */}
        <div className="text-[var(--fg-muted)]">Главное фото #{active+1}</div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="grid grid-cols-6 gap-2">
          {demo.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`thumb ${i+1}`}
              onClick={() => setActive(i)}
              className={`h-14 rounded-xl border transition
                ${active===i
                  ? 'border-[var(--brand)] outline outline-2 outline-[color-mix(in_hsl,var(--brand)_40%,transparent)]'
                  : 'border-[var(--border-muted)] hover:border-[var(--fg-muted)]'}`}
            >
              <div className="w-full h-full rounded-[10px] bg-[var(--bg-surface)]" />
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
