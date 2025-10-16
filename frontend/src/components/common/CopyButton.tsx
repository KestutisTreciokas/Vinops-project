'use client'
import { useState } from 'react'

export default function CopyButton({ text, title='Copy' }:{
  text: string; title?: string
}) {
  const [ok, setOk] = useState(false)
  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setOk(true); setTimeout(()=>setOk(false), 1200)
  }
  return (
    <button
      onClick={onCopy}
      className="copy-btn inline-flex items-center gap-1 rounded-md px-2 h-7 text-xs border border-[var(--border-muted)] hover:bg-[color-mix(in_hsl,var(--brand)_10%,transparent)]"
      title={title}
    >
      {ok ? '✔' : '⧉'}
    </button>
  )
}
