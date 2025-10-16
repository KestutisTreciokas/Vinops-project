'use client'
import type { ReactNode } from 'react'

export function Row({ icon, label, value }: { icon?: ReactNode; label: ReactNode; value?: ReactNode }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      {icon ? <div className="mt-0.5 h-5 w-5 shrink-0 text-fg-muted">{icon}</div> : <div className="w-5" />}
      <div className="flex-1 grid grid-cols-[120px_1fr] gap-x-2">
        <div className="text-fg-muted">{label}</div>
        <div className="text-fg-default">{value ?? '—'}</div>
      </div>
    </div>
  )
}

/* Набор простых outline-иконок под currentColor */
export const IcCalendar = (p:any)=>(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/></svg>)
export const IcCar      = (p:any)=>(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}><path d="M3 13l2-6a2 2 0 012-1h10a2 2 0 012 1l2 6M5 13h14M6 17h.01M18 17h.01"/></svg>)
export const IcEngine   = (p:any)=>(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}><path d="M3 10h5l2-2h4l2 2h5v6h-4l-2 2H7l-2-2H3zM7 10v8"/></svg>)
export const IcGear     = (p:any)=>(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}><path d="M12 15a3 3 0 100-6 3 3 0 000 6z"/><path d="M19.4 15a1 1 0 00.2 1.1l.1.1-1.3 2.3- .1-.1a1 1 0 00-1.2-.2l-1.2.5a8 8 0 01-1.9 1.1l-.2 1.3h-2.6l-.2-1.3a8 8 0 01-1.9-1.1l-1.2-.5a1 1 0 00-1.2.2l-.1.1-1.3-2.3.1-.1a1 1 0 00.2-1.1l-.5-1.2A8 8 0 013 12l-1.3-.2V9.2L3 9a8 8 0 011.1-1.9l.5-1.2a1 1 0 00-.2-1.2l-.1-.1L5.6 2.3l.1.1a1 1 0 001.1.2l1.2-.5A8 8 0 019 3l.2-1.3h2.6L12 3a8 8 0 011.9 1.1l1.2.5a1 1 0 001.1-.2l.1-.1 2.3 1.3-.1.1a1 1 0 00-.2 1.2l.5 1.2A8 8 0 0121 12l1.3.2v2.6L21 15a8 8 0 01-1.1 1.9l-.5 1.2z" strokeLinecap="round" strokeLinejoin="round"/></svg>)
export const IcDrive    = (p:any)=>(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}><path d="M4 12h16M4 12l3-3M4 12l3 3M20 12l-3-3M20 12l-3 3"/></svg>)
export const IcGavel    = (p:any)=>(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}><path d="M2 21h8M7 16l5-5M10 13l6-6 2 2-6 6zM13 10L9 6l2-2 4 4"/></svg>)
export const IcUser     = (p:any)=>(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}><path d="M12 12a4 4 0 100-8 4 4 0 000 8z"/><path d="M4 20a8 8 0 0116 0"/></svg>)
export const IcOdo      = (p:any)=>(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}><circle cx="12" cy="12" r="8"/><path d="M12 12l4-2"/></svg>)
export const IcTag      = (p:any)=>(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}><path d="M20 10l-8 8-8-8V4h6z"/><circle cx="7.5" cy="7.5" r="1"/></svg>)
