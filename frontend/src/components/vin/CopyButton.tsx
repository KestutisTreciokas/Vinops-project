'use client'
import { useState } from 'react'

export default function CopyButton({ text }: { text: string }) {
  const [ok, setOk] = useState(false)
  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setOk(true)
      setTimeout(() => setOk(false), 1500)
    } catch {}
  }
  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={onCopy}
        className="px-2 py-1 text-xs rounded-md border border-border-muted hover:bg-canvas-subtle text-fg-muted"
        aria-label="Copy VIN"
      >
        Copy
      </button>
      {ok && <span className="text-2xs text-fg-muted">Copied</span>}
    </div>
  )
}
