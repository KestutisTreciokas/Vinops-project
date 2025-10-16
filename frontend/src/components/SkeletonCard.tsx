'use client'
import React from 'react'

export default function SkeletonCard() {
  return (
    <div
      className="card relative overflow-hidden rounded-2xl border border-border-muted bg-bg-surface"
      aria-hidden
    >
      {/* верхняя «фото» зона */}
      <div className="h-40 w-full animate-pulse rounded-t-2xl bg-bg-muted" />
      {/* контент */}
      <div className="p-4 space-y-3">
        <div className="h-4 w-2/3 animate-pulse rounded bg-bg-muted" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-bg-muted" />
        <div className="h-3 w-5/6 animate-pulse rounded bg-bg-muted" />
      </div>

      {/* «цена» (заглушка) */}
      <div
        className="absolute right-3 top-3 rounded-lg border border-border-muted bg-bg-canvas px-3 py-1 text-sm"
        data-price
      >
        <span className="inline-block h-4 w-14 animate-pulse rounded bg-bg-muted" />
      </div>
    </div>
  )
}
