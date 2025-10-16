'use client'
import { useMemo, useState } from 'react'
import Lightbox from './Lightbox'

type Photo = { url: string; alt?: string }

export default function Gallery({ photos }: { photos?: Photo[] }) {
  const items = useMemo<Photo[]>(() => (Array.isArray(photos) ? photos : []), [photos])
  const [idx, setIdx] = useState(0)
  const [open, setOpen] = useState(false)

  if (!items.length) {
    return (
      <div className="card h-[220px] md:h-[260px] flex items-center justify-center text-[var(--fg-muted)]">
        <div className="text-center">
          <div className="mx-auto mb-2 w-10 h-10 rounded-full border border-[var(--border-muted)] flex items-center justify-center">📷</div>
          Нет изображений
        </div>
      </div>
    )
  }

  const current = items[Math.max(0, Math.min(idx, items.length - 1))]

  return (
    <div className="card p-3">
      {/* Главное фото */}
      <button
        className="w-full aspect-video bg-[var(--bg-muted)] rounded-lg overflow-hidden"
        onClick={() => setOpen(true)}
        aria-label="Open image"
      >
        <img
          src={current.url}
          alt={current.alt ?? ''}
          className="w-full h-full object-contain"
        />
      </button>

      {/* Превью */}
      <div className="mt-3 flex gap-2 overflow-x-auto">
        {items.map((p, i) => (
          <button
            key={p.url + i}
            className={`h-16 w-24 shrink-0 rounded-md overflow-hidden border ${
              i === idx ? 'border-[var(--brand)]' : 'border-[var(--border-muted)]'
            }`}
            onClick={() => setIdx(i)}
            aria-label={`Thumbnail ${i + 1}`}
          >
            <img
              src={p.url}
              alt={p.alt ?? ''}
              loading="lazy"
              className="w-full h-full object-cover"
            />
          </button>
        ))}
      </div>

      {open && (
        <Lightbox
          photos={items}
          index={idx}
          onClose={() => setOpen(false)}
          onIndex={(n) => setIdx(n)}
        />
      )}
    </div>
  )
}
