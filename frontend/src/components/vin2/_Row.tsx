import React from 'react'

export default function Row({
  k,
  v,
  icon,
}: {
  k: React.ReactNode
  v: React.ReactNode
  icon?: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[auto,1fr,auto] items-center gap-x-2">
      {icon ? (
        <span
          className="inline-flex w-4 h-4 items-center justify-center text-[var(--fg-muted)]"
          aria-hidden
        >
          {icon}
        </span>
      ) : (
        /* пустая первая колонка схлопывается в 0 */
        <span className="w-0 h-4" aria-hidden />
      )}
      <span className="text-[var(--fg-muted)]">{k}</span>
      <span className="justify-self-end">{v}</span>
    </div>
  )
}
