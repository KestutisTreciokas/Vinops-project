'use client'

import OutcomeBadge from './OutcomeBadge'
import PriceInfo from './PriceInfo'

export interface AuctionAttempt {
  lotId: number
  outcome?: 'sold' | 'not_sold' | 'on_approval' | 'unknown' | null
  outcomeConfidence?: number | null
  outcomeDate?: string | null
  auctionDateTimeUtc?: string | null
  currentBidUsd?: number | null
  finalBidUsd?: number | null
  siteCode?: string | null
  city?: string | null
}

export interface AuctionHistoryTimelineProps {
  /** Current lot information */
  currentAttempt?: AuctionAttempt | null
  /** Number of times this VIN was relisted */
  relistCount?: number | null
  /** Language for labels */
  lang?: 'ru' | 'en'
}

const LABELS = {
  title: { ru: 'История аукционов', en: 'Auction History' },
  currentAttempt: { ru: 'Текущий аукцион', en: 'Current Auction' },
  previousAttempts: { ru: 'Предыдущие попытки', en: 'Previous Attempts' },
  auctionDate: { ru: 'Дата аукциона', en: 'Auction Date' },
  location: { ru: 'Локация', en: 'Location' },
  lotNumber: { ru: 'Лот №', en: 'Lot #' },
  relistInfo: { ru: 'раз на аукционе', en: 'auction attempt(s)' },
  noHistory: { ru: 'Нет истории аукционов', en: 'No auction history available' },
}

function formatDate(isoDate: string | null | undefined): string | null {
  if (!isoDate) return null
  try {
    return new Date(isoDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return null
  }
}

export default function AuctionHistoryTimeline({
  currentAttempt,
  relistCount,
  lang = 'ru',
}: AuctionHistoryTimelineProps) {
  if (!currentAttempt) {
    return (
      <div className="text-sm text-zinc-500 dark:text-zinc-400 italic py-4">
        {lang === 'ru' ? LABELS.noHistory.ru : LABELS.noHistory.en}
      </div>
    )
  }

  const totalAttempts = (relistCount ?? 0) + 1

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {lang === 'ru' ? LABELS.title.ru : LABELS.title.en}
        </h3>
        {relistCount !== null && relistCount !== undefined && relistCount > 0 && (
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            {totalAttempts} {lang === 'ru' ? LABELS.relistInfo.ru : LABELS.relistInfo.en}
          </span>
        )}
      </div>

      {/* Current Attempt */}
      <div className="border-l-4 border-blue-500 pl-4 py-2 bg-blue-50/50 dark:bg-blue-900/10 rounded-r">
        <div className="flex items-start justify-between mb-2">
          <div className="text-sm font-medium text-blue-700 dark:text-blue-300">
            {lang === 'ru' ? LABELS.currentAttempt.ru : LABELS.currentAttempt.en}
          </div>
          <OutcomeBadge
            outcome={currentAttempt.outcome}
            confidence={currentAttempt.outcomeConfidence}
            lang={lang}
            showConfidence={false}
          />
        </div>

        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
            <span className="font-medium">
              {lang === 'ru' ? LABELS.lotNumber.ru : LABELS.lotNumber.en}
            </span>
            <span>{currentAttempt.lotId}</span>
          </div>

          {currentAttempt.auctionDateTimeUtc && (
            <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
              <span className="font-medium">
                {lang === 'ru' ? LABELS.auctionDate.ru : LABELS.auctionDate.en}:
              </span>
              <span>{formatDate(currentAttempt.auctionDateTimeUtc)}</span>
            </div>
          )}

          {(currentAttempt.city || currentAttempt.siteCode) && (
            <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
              <span className="font-medium">
                {lang === 'ru' ? LABELS.location.ru : LABELS.location.en}:
              </span>
              <span>
                {currentAttempt.city && currentAttempt.city}
                {currentAttempt.siteCode && ` (${currentAttempt.siteCode})`}
              </span>
            </div>
          )}

          {(currentAttempt.currentBidUsd || currentAttempt.finalBidUsd) && (
            <div className="mt-2">
              <PriceInfo
                currentBidUsd={currentAttempt.currentBidUsd}
                finalBidUsd={currentAttempt.finalBidUsd}
                lang={lang}
                variant="block"
              />
            </div>
          )}
        </div>
      </div>

      {/* Relist indicator */}
      {relistCount !== null && relistCount !== undefined && relistCount > 0 && (
        <div className="text-xs text-zinc-500 dark:text-zinc-400 pl-4">
          <span className="inline-flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>
              {lang === 'ru'
                ? `Этот VIN был повторно выставлен ${relistCount} раз`
                : `This VIN was relisted ${relistCount} time${relistCount > 1 ? 's' : ''}`
              }
            </span>
          </span>
        </div>
      )}
    </div>
  )
}
