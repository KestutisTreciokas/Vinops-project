'use client'

type Kind = 'success'|'warning'|'neutral'

const map: Record<Kind,string> = {
  success: 'bg-[color-mix(in_hsl,var(--brand)_18%,transparent)] text-[var(--brand-contrast)]',
  warning: 'bg-[color-mix(in_hsl,orange_25%,transparent)] text-[var(--fg-default)]',
  neutral: 'bg-[var(--bg-muted)] text-[var(--fg-muted)]',
}

export default function Badge({ kind='neutral', children }: { kind?: Kind; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 h-6 text-xs font-medium ${map[kind]}`}>
      {children}
    </span>
  )
}
