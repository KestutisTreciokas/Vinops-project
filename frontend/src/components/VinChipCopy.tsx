'use client'

import { useEffect, useRef, useState } from 'react'

type Props = { vin: string; lang: 'en' | 'ru' }

export default function VinChipCopy({ vin, lang }: Props) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const t = (en: string, ru: string) => (lang === 'ru' ? ru : en)
  const label = t('Copy VIN', 'Скопировать VIN')
  const ok = t('Copied', 'Скопировано')
  const fail = t('Copy failed', 'Не удалось скопировать')
  const timer = useRef<number | null>(null)

  useEffect(() => {
    return () => { if (timer.current) window.clearTimeout(timer.current) }
  }, [])

  async function doCopy() {
    setError(null)
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(vin)
      } else {
        // Fallback без глобалей
        const ta = document.createElement('textarea')
        ta.value = vin
        ta.setAttribute('readonly', '')
        ta.style.position = 'fixed'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopied(true)
      timer.current = window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setError(fail)
      timer.current = window.setTimeout(() => setError(null), 2000)
    }
  }

  return (
    <span
      className="vin-chip inline-flex items-center gap-1 rounded border border-border-muted px-2 py-1 text-xs"
      data-vin-value={vin}
      data-copied={copied ? 'true' : 'false'}
      data-action="copy"
    >
      <span className="text-fg-muted">{t('VIN', 'VIN')}:</span>
      <code className="font-mono">{vin}</code>
      <button
        type="button"
        className="copy-btn inline-flex items-center gap-1 rounded-md px-2 h-7 text-xs border border-[var(--border-muted)] hover:bg-[color-mix(in_hsl,var(--brand)_10%,transparent)]"
        onClick={doCopy}
        aria-label={label}
        title={label}
      >
        ⧉ <span className="sr-only">{label}</span>
      </button>
      <span
        role="status"
        aria-live="polite"
        className="ml-1 text-[var(--fg-muted)]"
        data-copy-hint=""
      >
        {copied ? ok : ''}
      </span>
      {error ? <span className="ml-1 text-red-600">{error}</span> : null}
    </span>
  )
}
