'use client'
import { useState } from 'react'

type Props = { images: string[], title?: string }

export default function VinGallery({ images, title }: Props) {
  const [i, setI] = useState(0)
  const src = images?.[i]

  if (!images?.length) {
    return (
      <div className="card p-4">
        <div className="text-fg-muted">Нет изображений</div>
      </div>
    )
  }

  return (
    <div className="card p-4">
      <div className="mb-3 text-sm text-fg-muted">{title ?? 'Главное фото'}</div>
      <div className="aspect-[16/10] rounded-xl overflow-hidden bg-bg-elevated ring-1 ring-border-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="w-full h-full object-cover" />
      </div>

      <div className="mt-3 flex gap-2">
        {images.slice(0,8).map((s, idx) => {
          const active = idx === i
          return (
            <button
              key={idx}
              onClick={() => setI(idx)}
              className={`shrink-0 aspect-[1/1] w-10 rounded-md overflow-hidden ring-1
                          ${active ? 'ring-brand outline outline-2 outline-brand/30' : 'ring-border-muted'}`}
              aria-label={`Фото ${idx+1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s} alt="" className="w-full h-full object-cover" />
            </button>
          )
        })}
      </div>
    </div>
  )
}
