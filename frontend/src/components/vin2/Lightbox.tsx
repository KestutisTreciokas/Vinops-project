'use client'
import { useEffect } from 'react'

type Photo = { url: string; alt?: string }

export default function Lightbox({
  photos,
  index,
  onClose,
  onIndex,
}: {
  photos: Photo[]
  index: number
  onClose: () => void
  onIndex: (next: number) => void
}) {
  const count = photos?.length ?? 0
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!count) return
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') onIndex((index + 1) % count)
      if (e.key === 'ArrowLeft') onIndex((index - 1 + count) % count)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [index, count, onClose, onIndex])

  if (!count) return null
  const p = photos[index]

  return (
    <div className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-center justify-center">
      {/* клик по фону = закрыть */}
      <button className="absolute inset-0" onClick={onClose} aria-label="Close overlay" />
      <div className="relative max-w-[90vw] max-h-[90vh]">
        <img
          src={p.url}
          alt={p.alt ?? ''}
          className="max-w-[90vw] max-h-[90vh] rounded-xl shadow-2xl object-contain"
        />
        <button
          aria-label="Previous"
          className="absolute left-0 top-1/2 -translate-y-1/2 p-3 bg-black/40 text-white rounded-full"
          onClick={() => onIndex((index - 1 + count) % count)}
        >
          ‹
        </button>
        <button
          aria-label="Next"
          className="absolute right-0 top-1/2 -translate-y-1/2 p-3 bg-black/40 text-white rounded-full"
          onClick={() => onIndex((index + 1) % count)}
        >
          ›
        </button>
        <button
          aria-label="Close"
          className="absolute -top-10 right-0 px-3 py-1 bg-black/50 text-white rounded-md"
          onClick={onClose}
        >
          ✕
        </button>
      </div>
    </div>
  )
}
