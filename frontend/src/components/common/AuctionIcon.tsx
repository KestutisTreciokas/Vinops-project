'use client'

export default function AuctionIcon({ name, className='' }: { name?: string; className?: string }) {
  const n = (name || '').toLowerCase()
  const isCopart = n.includes('copart')
  const isIaai   = n.includes('iaai') || n.includes('iaa')

  if (isCopart) {
    return (
      <svg viewBox="0 0 24 24" className={`w-4 h-4 ${className}`} aria-hidden>
        <circle cx="12" cy="12" r="10" fill="currentColor" opacity=".12"/>
        <path d="M4 13h9.5M4 17h6.5M4 9h13M17 9l3-2v10l-3-2" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  }
  if (isIaai) {
    return (
      <svg viewBox="0 0 24 24" className={`w-4 h-4 ${className}`} aria-hidden>
        <rect x="3" y="6" width="18" height="12" rx="2" fill="currentColor" opacity=".12"/>
        <path d="M6 16V8m6 8V8m6 8V8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className={`w-4 h-4 ${className}`} aria-hidden>
      <path d="M4 7h16v10H4z" fill="currentColor" opacity=".12"/>
      <path d="M4 7h16v10H4zM4 11h16" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
